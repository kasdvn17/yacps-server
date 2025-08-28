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
import { ProblemsService } from './problems.service';

@Controller()
export class TestcasesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly problemsService: ProblemsService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @UseGuards(AuthGuard)
  @Post('/:slug/finalize-testcase-upload')
  async finalize(
    @Param('slug') slug: string,
    @Body() body: any,
    @LoggedInUser() user: User,
  ) {
    const problem =
      await this.problemsService.findViewableProblemWithSlugIncludeMods(
        slug,
        user,
      );
    if (!problem) throw new InternalServerErrorException('PROBLEM_NOT_FOUND');
    const canEditTestCases = this.permissionsService.hasPerms(
      user?.perms || 0n,
      UserPermissions.EDIT_PROBLEM_TESTS,
    );
    const isAuthor = problem.authors.some((a) => a.id === user.id);
    const isCurator = problem.curators.some((c) => c.id === user.id);
    if (!isAuthor && !isCurator && !canEditTestCases)
      throw new ForbiddenException('INSUFFICIENT_PERMISSIONS');

    // Accept URL-based archive uploads
    if (body && body.url) {
      try {
        const res = await axios.get(body.url, { responseType: 'arraybuffer' });
        const buf = Buffer.from(res.data);
        if (buf.length < 4 || buf.readUInt32LE(0) !== 0x04034b50)
          throw new InternalServerErrorException('NOT_A_ZIP');

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
          /* empty */
        }

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
        } catch (e) {
          console.error('Failed to record archive', e);
        }

        return { success: true, message: 'Archive received', hasInit };
      } catch {
        throw new InternalServerErrorException('DOWNLOAD_OR_PARSE_FAILED');
      }
    }

    // Payload-based finalize: build VNOI-like init.yml
    if (body && Array.isArray(body.cases)) {
      try {
        const cases: any[] = body.cases;
        const checker = body.checker || null;
        const init: any = {};

        init.archive =
          body.archive ||
          body.archiveName ||
          (body.archiveUrl
            ? String(body.archiveUrl).split('/').pop()?.split('?')[0]
            : null) ||
          'archive.zip';

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
        let totalPoints = 0;

        for (let i = 0; i < cases.length; i++) {
          if (selectedIndices && !selectedIndices.includes(i)) continue;
          const c = cases[i];
          const type = c.type || 'C';

          if (type === 'S') {
            if (
              currentBatch &&
              currentBatch.batched &&
              currentBatch.batched.length
            ) {
              if (currentBatch.is_pretest) pretest.push(currentBatch);
              test_cases.push(currentBatch);
            }
            currentBatch = {
              points: c.points ?? 0,
              batched: [],
              is_pretest: !!c.is_pretest,
            };
            if (c.points != null) totalPoints += c.points;
            if (c.generator_args)
              currentBatch.generator_args = String(c.generator_args).split(
                '\n',
              );
            if (c.output_limit != null)
              currentBatch.output_limit_length = c.output_limit;
            if (c.output_prefix != null)
              currentBatch.output_prefix_length = c.output_prefix;
            continue;
          }

          if (type === 'E') {
            if (currentBatch) {
              if (!currentBatch.batched || currentBatch.batched.length === 0)
                throw new InternalServerErrorException(
                  'EMPTY_BATCH_NOT_ALLOWED',
                );
              if (currentBatch.is_pretest) pretest.push(currentBatch);
              test_cases.push(currentBatch);
              currentBatch = null;
            }
            continue;
          }

          const item: any = {};
          if (c.input) item['in'] = c.input;
          if (c.output) item['out'] = c.output;
          if (c.points != null) item['points'] = c.points;
          if (c.generator_args)
            item['generator_args'] = String(c.generator_args).split('\n');
          if (c.output_limit != null)
            item['output_limit_length'] = c.output_limit;
          if (c.output_prefix != null)
            item['output_prefix_length'] = c.output_prefix;
          if (c.checker) item['checker'] = makeCheckerFor(c.checker);

          if (currentBatch) currentBatch.batched.push(item);
          else {
            if (c.is_pretest) {
              pretest.push(item);
              test_cases.push(item);
            } else {
              if (c.points == null)
                throw new InternalServerErrorException(
                  'POINTS_MUST_BE_DEFINED_FOR_NON_BATCH_CASES',
                );
              totalPoints += c.points || 0;
              test_cases.push(item);
            }
          }
        }

        if (currentBatch) {
          if (!currentBatch.batched || currentBatch.batched.length === 0)
            throw new InternalServerErrorException('EMPTY_BATCH_NOT_ALLOWED');
          if (currentBatch.is_pretest) pretest.push(currentBatch);
          test_cases.push(currentBatch);
          currentBatch = null;
        }

        if (pretest.length) init.pretest_test_cases = pretest;
        if (test_cases.length) init.test_cases = test_cases;
        if (totalPoints <= 0)
          throw new InternalServerErrorException(
            'TOTAL_POINTS_MUST_BE_GREATER_THAN_ZERO',
          );

        // Port of LQDOJ make_checker(): accepts either a simple string or
        // an object { name, args, key, url }
        const normalizeChecker = (ck: any) => {
          if (!ck) return null;
          // If caller passed a plain string (e.g. 'standard', 'interact') return as-is
          if (typeof ck === 'string') return ck;
          // If ck has a 'default' marker, ignore
          if (ck.default) return null;

          const name = ck.name || 'bridged';
          const args: Record<string, any> = ck.args || {};

          // Floats family -> 'floats' with precision default 6
          if (name && name.startsWith('floats')) {
            return {
              name: 'floats',
              args: { precision: args.precision ?? 6 },
            } as any;
          }

          // If explicit args.files provided, pass through
          if (args.files) return { name, args: { ...args } } as any;

          // If a storage key is provided (uploaded file), use basename
          if (ck.key) {
            const parts = String(ck.key).split('/');
            const basename = parts[parts.length - 1] || String(ck.key);
            const outArgs: any = { files: basename };
            if (args.lang) outArgs.lang = args.lang;
            if (args.type) outArgs.type = args.type;
            // defaults for .cpp uploaded checkers
            if (!outArgs.type && basename.toLowerCase().endsWith('.cpp'))
              outArgs.type = 'testlib';
            if (!outArgs.lang && basename.toLowerCase().endsWith('.cpp'))
              outArgs.lang = 'CPP20';
            return { name, args: outArgs } as any;
          }

          // If a URL was provided, expose it and any args
          if (ck.url) {
            const out: any = { name };
            if (args && Object.keys(args).length) out.args = { ...args };
            out.url = ck.url;
            return out;
          }

          // If args exist, return them
          if (args && Object.keys(args).length)
            return { name, args: { ...args } };

          // Fallback: return the name string (e.g. 'standard')
          return name;
        };

        // Per-case make_checker: mirrors LQDOJ behaviour where some checkers
        // like 'custom' return a plain filename, while 'customcpp'/'testlib'
        // map to bridged descriptors.
        function makeCheckerFor(caseChecker: any) {
          if (!caseChecker) return null;
          // plain string
          if (typeof caseChecker === 'string') {
            if (caseChecker === 'custom') return null; // frontend should supply uploaded key
            if (caseChecker === 'customcpp')
              return { name: 'bridged', args: { files: caseChecker } } as any;
            if (caseChecker === 'testlib')
              return {
                name: 'bridged',
                args: { files: caseChecker, type: 'testlib' },
              } as any;
            return caseChecker;
          }
          // object
          // If custom -> return basename string when key/url provided
          if (caseChecker.name === 'custom') {
            if (caseChecker.key)
              return String(caseChecker.key).split('/').pop();
            if (caseChecker.args && caseChecker.args.files)
              return caseChecker.args.files;
            return null;
          }
          if (
            caseChecker.name === 'customcpp' ||
            caseChecker.name === 'testlib'
          ) {
            // prefer uploaded key or args.files
            const candidate = caseChecker.key
              ? String(caseChecker.key).split('/').pop()
              : caseChecker.args?.files;
            const lang =
              caseChecker.args?.lang ||
              (candidate && candidate.toLowerCase().endsWith('.cpp')
                ? 'CPP20'
                : undefined);
            const type = caseChecker.name === 'customcpp' ? 'lqdoj' : 'testlib';
            if (candidate)
              return {
                name: 'bridged',
                args: { files: candidate, lang, type },
              } as any;
          }
          if (caseChecker.args)
            return {
              name: caseChecker.name || 'bridged',
              args: caseChecker.args,
            };
          return caseChecker.name || null;
        }

        const normalizedChecker = normalizeChecker(checker);

        // LQDOJ: interactive is selected via checker value 'interact' or 'interacttl'
        const checkerName = (checker && (checker.name || checker)) || null;
        const isInteractiveChecker =
          checkerName === 'interact' || checkerName === 'interacttl';

        if (isInteractiveChecker) {
          // prefer normalizedChecker args.files, otherwise fall back to raw checker.args.files
          const chosen =
            normalizedChecker &&
            normalizedChecker.args &&
            normalizedChecker.args.files
              ? normalizedChecker
              : checker && checker.args && checker.args.files
                ? checker
                : null;
          if (chosen && chosen.args && chosen.args.files) {
            init.interactive = {
              files: chosen.args.files,
              type:
                checkerName === 'interact'
                  ? 'lqdoj'
                  : chosen.args.type || 'testlib',
              lang: chosen.args.lang,
              feedback: body.interactive?.feedback ?? true,
            } as any;
            init.unbuffered =
              typeof body.interactive?.unbuffered !== 'undefined'
                ? body.interactive.unbuffered
                : true;
          }
        } else {
          if (normalizedChecker) init.checker = normalizedChecker;
        }
        // output-only flag (LQDOJ uses data.output_only)
        if (body.output_only || body.outputOnly) init.output_only = true;

        // file IO mapping: accept body.file_io or explicit ioInputFile/ioOutputFile
        // We allow one-side file IO (input or output) to be specified; if both
        // are empty, we leave stdin/stdout behaviour (no file_io entry).
        const inputFileBody =
          body.ioInputFile ||
          body.grader_args?.io_input_file ||
          body.file_io?.input ||
          null;
        const outputFileBody =
          body.ioOutputFile ||
          body.grader_args?.io_output_file ||
          body.file_io?.output ||
          null;

        // If at least one side is specified (non-empty string), include file_io
        // and persist the default file IO names to the Problem row so other
        // parts of the system can default to those filenames.
        let providedFileIo: { input?: string; output?: string } | null = null;
        if (
          (typeof inputFileBody === 'string' && inputFileBody !== '') ||
          (typeof outputFileBody === 'string' && outputFileBody !== '')
        ) {
          const fileIo: any = {};
          if (typeof inputFileBody === 'string' && inputFileBody !== '')
            fileIo.input = inputFileBody;
          if (typeof outputFileBody === 'string' && outputFileBody !== '')
            fileIo.output = outputFileBody;
          init.file_io = fileIo;
          providedFileIo = fileIo;
        }

        // signature grader: accept body.signature or body.signature_grader
        const sig =
          body.signature || body.signature_grader || body.grader_args || null;
        if (sig && (sig.entry || sig.header)) {
          init.signature_grader = {} as any;
          if (sig.entry) init.signature_grader.entry = sig.entry;
          if (sig.header) init.signature_grader.header = sig.header;
          if (sig.allow_main) init.signature_grader.allow_main = true;
        }

        const yaml = await (async () => {
          const mod = await import('js-yaml');
          return mod.dump(init);
        })();

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

            // Persist hasTestData and optionally update Problem.input/output
            const updateData: any = { hasTestData: true };
            if (providedFileIo) {
              if (providedFileIo.input) {
                updateData.input = providedFileIo.input;
              }
              if (providedFileIo.output) {
                updateData.output = providedFileIo.output;
              }
            }

            await this.prisma.problem.update({
              where: { id: problem.id },
              data: updateData,
            });
          } catch (e) {
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
