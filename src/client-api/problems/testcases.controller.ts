import {
  Controller,
  Post,
  Body,
  Param,
  ForbiddenException,
  UseGuards,
  InternalServerErrorException,
} from '@nestjs/common';
import axios from 'axios';
import { AuthGuard } from '@/client-api/auth/auth.guard';
import { LoggedInUser } from '@/client-api/users/users.decorator';
import { User } from '@prisma/client';
import JSZip from 'jszip';
import { PrismaService } from '@/prisma/prisma.service';
import { UserPermissions } from 'constants/permissions';
import { PermissionsService } from '../auth/permissions.service';

@Controller()
export class TestcasesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  // POST /:slug/finalize-testcase-upload
  @UseGuards(AuthGuard)
  @Post('/:slug/finalize-testcase-upload')
  async finalize(
    @Param('slug') slug: string,
    @Body() body: any,
    @LoggedInUser() user: User,
  ) {
    // Accept either URL-based flow { url, name } or payload-based flow:
    // { cases: [{ input, output?, type? }], checker?: { url|key|name } | { default: true }, selectedIndices?: number[] }

    // Verify user has permission to modify the problem (author/curator/tester or global)
    const problem = await this.prisma.problem.findUnique({
      where: { slug },
      include: { authors: true, curators: true, testers: true },
    });
    if (!problem) throw new InternalServerErrorException('PROBLEM_NOT_FOUND');

    const canEditTestCases = this.permissionsService.hasPerms(
      user?.perms || 0n,
      UserPermissions.EDIT_PROBLEM_TESTS,
    );
    const isAuthor = problem.authors.some((a) => a.id === user.id);
    const isCurator = problem.curators.some((c) => c.id === user.id);
    const isTester = problem.testers.some((t) => t.id === user.id);
    if (!isAuthor && !isCurator && !isTester && !canEditTestCases) {
      throw new ForbiddenException('INSUFFICIENT_PERMISSIONS');
    }

    // URL flow: preserve existing behaviour
    if (body && body.url) {
      try {
        const res = await axios.get(body.url, { responseType: 'arraybuffer' });
        const buf = Buffer.from(res.data);

        // simple zip magic (PK\x03\x04)
        if (buf.length < 4 || buf.readUInt32LE(0) !== 0x04034b50) {
          throw new InternalServerErrorException('NOT_A_ZIP');
        }

        // try parse with JSZip to look for init.yml
        let hasInit = false;
        try {
          const zip = await JSZip.loadAsync(buf);
          const names = Object.keys(zip.files);
          hasInit = names.some(
            (n) =>
              n.toLowerCase().endsWith('init.yml') ||
              n.toLowerCase().endsWith('init.yaml'),
          );
        } catch {
          // non-fatal; we already validated magic bytes
        }

        // Record archive metadata and mark the problem as having test data
        try {
          const crypto = await import('crypto');
          const hash = crypto.createHash('sha256').update(buf).digest('hex');
          const size = buf.length;

          await this.prisma.problemArchive.create({
            data: {
              problemId: problem.id,
              filename: body.name || 'upload.zip',
              url: body.url,
              sha256: hash,
              size,
              hasInit,
            },
          });

          await this.prisma.problem.update({
            where: { id: problem.id },
            data: { hasTestData: true } as any,
          });
        } catch {
          // non-fatal
        }

        // Minimal: return whether init.yml found
        return { success: true, message: 'Archive received', hasInit };
      } catch {
        throw new InternalServerErrorException('DOWNLOAD_OR_PARSE_FAILED');
      }
    }

    // Payload flow: generate init.yml from provided cases/checker
    if (body && Array.isArray(body.cases)) {
      try {
        // Build init structure (VNOI-like)
        const cases: any[] = body.cases;
        const checker = body.checker || null;

        const init: any = {};

        // Archive pointer: we'll set archive to archive.zip if an archive exists later
        init['archive'] = `archive.zip`;

        // Build test_cases and pretest_test_cases by handling S (start batch), C (case), E (end batch)
        const selectedIndices: number[] | null = Array.isArray(
          body.selectedIndices,
        )
          ? body.selectedIndices
          : null;

        const pretest: any[] = [];
        const test_cases: any[] = [];

        type Batch = {
          points: number | null;
          batched: Array<Record<string, unknown>>;
          is_pretest: boolean;
          generator_args?: string[];
          output_limit_length?: number | null;
          output_prefix_length?: number | null;
        };

        let currentBatch: Batch | null = null;

        for (let i = 0; i < cases.length; i++) {
          if (selectedIndices && !selectedIndices.includes(i)) continue;
          const c = cases[i];

          const type = c.type || 'C';

          if (type === 'S') {
            // start batch
            if (currentBatch) {
              // end previous batch implicitly
              if (!currentBatch.batched || currentBatch.batched.length === 0) {
                // skip empty
              } else {
                test_cases.push(currentBatch);
              }
            }
            currentBatch = {
              points: c.points ?? 0,
              batched: [],
              is_pretest: !!c.is_pretest,
            };
            if (c.generator_args)
              currentBatch.generator_args = (c.generator_args as string).split(
                '\n',
              );
            if (c.output_limit != null)
              currentBatch.output_limit_length = c.output_limit;
            if (c.output_prefix != null)
              currentBatch.output_prefix_length = c.output_prefix;
            continue;
          }

          if (type === 'E') {
            // end batch
            if (currentBatch) {
              if (!currentBatch.batched || currentBatch.batched.length === 0) {
                // do nothing
              } else {
                test_cases.push(currentBatch);
              }
              currentBatch = null;
            }
            continue;
          }

          // type C (normal case)
          const item: any = {};
          if (c.input) item['in'] = c.input;
          if (c.output) item['out'] = c.output;
          if (c.points != null) item['points'] = c.points;
          if (c.generator_args)
            item['generator_args'] = (c.generator_args as string).split('\n');
          if (c.output_limit != null)
            item['output_limit_length'] = c.output_limit;
          if (c.output_prefix != null)
            item['output_prefix_length'] = c.output_prefix;
          if (c.checker) item['checker'] = c.checker;
          if (currentBatch) {
            currentBatch.batched.push(item);
          } else {
            test_cases.push(item);
          }
        }

        if (test_cases.length) init['test_cases'] = test_cases;
        if (pretest.length) init['pretest_test_cases'] = pretest;

        // Attach checker information (support multiple types similar to VNOI)
        if (checker) {
          // checker payload shapes sent from FE may be:
          // { default: true }
          // { name: 'bridged', url, key, type: 'bridged' }
          // { name: 'floats', args: { precision } }
          // { name: 'custom', args: {...} }
          if (checker.default) {
            // Use judge default checker -- no explicit entry needed
          } else if (checker.type === 'bridged' || checker.url || checker.key) {
            // Bridged / uploaded checker: prefer url if available for immediate reference
            init['checker'] = {
              name: (checker.name as string) || 'custom',
            } as any;
            if (checker.url) init['checker']['url'] = checker.url;
            if (checker.key) init['checker']['path'] = checker.key;
          } else if (
            checker.name === 'floats' ||
            (checker.name && (checker.name as string).startsWith('floats'))
          ) {
            // Floating point checker with precision
            init['checker'] = {
              name: 'floats',
              args: checker.args || { precision: 6 },
            };
          } else if (checker.args) {
            // Generic custom checker args
            init['checker'] = {
              name: checker.name || 'custom',
              args: checker.args,
            } as any;
          }
        }

        // Dump YAML
        const yaml = await (async () => {
          // dynamic import to avoid adding yaml dependency in this file top-level
          const mod = await import('js-yaml');
          const dumper = mod.dump;
          return dumper(init);
        })();

        // Upload init.yml to object storage under tests/{slug}/init.yml
        try {
          const [{ S3Client, PutObjectCommand }, { getSignedUrl }] =
            await Promise.all([
              import('@aws-sdk/client-s3'),
              import('@aws-sdk/s3-request-presigner'),
            ]);

          const s3 = new S3Client({
            region: process.env.STORAGE_REGION || 'auto',
            endpoint: process.env.STORAGE_ENDPOINT,
            credentials: {
              accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || '',
              secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || '',
            },
            forcePathStyle: false,
          });

          const key = `tests/${slug}/init.yml`;
          await s3.send(
            new PutObjectCommand({
              Bucket: process.env.STORAGE_BUCKET,
              Key: key,
              Body: Buffer.from(yaml),
              ContentType: 'text/yaml',
            } as any),
          );

          // create a short-lived GET URL for backend record
          let downloadUrl = '';
          try {
            const { GetObjectCommand } = await import('@aws-sdk/client-s3');
            downloadUrl = await getSignedUrl(
              s3,
              new GetObjectCommand({
                Bucket: process.env.STORAGE_BUCKET,
                Key: key,
              }),
              { expiresIn: 900 },
            );
          } catch {
            downloadUrl = `s3://${process.env.STORAGE_BUCKET}/${key}`;
          }

          // Record an archive row pointing to the init.yml (not a full archive) so migrations/clients can see test data
          try {
            await this.prisma.problemArchive.create({
              data: {
                problemId: problem.id,
                filename: 'init.yml',
                url: downloadUrl,
                sha256: '',
                size: yaml.length,
                hasInit: true,
              },
            });

            await this.prisma.problem.update({
              where: { id: problem.id },
              data: { hasTestData: true } as any,
            });
          } catch (e) {
            // non-fatal
            console.error('Failed to record ProblemArchive for init.yml', e);
          }
        } catch (e) {
          console.error('Failed to upload init.yml to storage', e);
        }

        return {
          success: true,
          message: 'init.yml generated and stored',
          hasInit: true,
        };
      } catch (e) {
        console.error('Failed to generate init.yml', e);
        throw new InternalServerErrorException('INIT_GENERATION_FAILED');
      }
    }

    throw new InternalServerErrorException('MISSING_PAYLOAD');
  }
}
