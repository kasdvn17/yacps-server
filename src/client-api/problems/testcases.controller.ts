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

@Controller('problem')
export class TestcasesController {
  constructor(private readonly prisma: PrismaService) {}

  // POST /problem/:slug/finalize-testcase-upload
  @UseGuards(AuthGuard)
  @Post(':slug/finalize-testcase-upload')
  async finalize(
    @Param('slug') slug: string,
    @Body() body: { url: string; name: string },
    @LoggedInUser() user: User,
  ) {
    if (!body || !body.url)
      throw new InternalServerErrorException('MISSING_URL');

    // Verify user has permission to modify the problem (author/curator/tester or global)
    const problem = await this.prisma.problem.findUnique({
      where: { slug },
      include: { authors: true, curators: true, testers: true },
    });
    if (!problem) throw new InternalServerErrorException('PROBLEM_NOT_FOUND');

    const isAuthor = problem.authors.some((a) => a.id === user.id);
    const isCurator = problem.curators.some((c) => c.id === user.id);
    const isTester = problem.testers.some((t) => t.id === user.id);
    if (!isAuthor && !isCurator && !isTester) {
      throw new ForbiddenException('INSUFFICIENT_PERMISSIONS');
    }

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
}
