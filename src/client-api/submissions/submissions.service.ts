import { SubmissionQueueService } from '@/judge-api/submission-queue/submission-queue.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Problem, TestcaseDataVisibility, User } from '@prisma/client';
import { PermissionsService } from '../auth/permissions.service';
import { UserPermissions } from 'constants/permissions';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { ProblemsService } from '../problems/problems.service';

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    private prismaService: PrismaService,
    private queueService: SubmissionQueueService,
    private eventEmitter: EventEmitter2,
    private permissionsService: PermissionsService,
    private problemsService: ProblemsService,
  ) {}

  /**
   * Creates a new submission for a problem.
   * @param user The user making the submission.
   * @param problem The problem for which the submission is made.
   * @param code The source code of the submission.
   * @param language The programming language of the submission.
   * @param contestantId Optional contestant ID for team submissions.
   * @param isPretest Whether this submission is a pretest (default: false).
   * @returns The created submission object.
   */
  async createSubmission(
    user: User,
    problem: Problem,
    code: string,
    language: string,
    contestantId?: number,
    isPretest?: boolean,
  ) {
    try {
      const submission = await this.prismaService.submission.create({
        data: {
          authorId: user.id,
          problemId: problem.id,
          contestantId: contestantId,
          code: code,
          language: language,
          isPretest: isPretest || false,
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              fullname: true,
            },
          },
          problem: {
            select: {
              id: true,
              slug: true,
              name: true,
              points: true,
            },
          },
        },
      });

      // Add to queue
      await this.queueService.addToQueue(submission.id);

      this.logger.log(
        `Submission ${submission.id} created by user ${user.username} for problem ${problem.slug}`,
      );

      // Emit event for live updates
      this.eventEmitter.emit('submission.created', {
        submissionId: submission.id,
        authorId: user.id,
        problemId: problem.id,
        timestamp: new Date(),
      });

      return submission;
    } catch (err) {
      throw new InternalServerErrorException('UNKNOWN_ERROR', err);
    }
  }

  /**
   * Create a submission that uses an uploaded file (e.g., Scratch .sb3).
   * This will store uploadedFileUrl and uploadedFileName on the submission record
   * and enqueue it for judging. The 'code' field is set to a placeholder.
   */
  async createSubmissionWithFile(
    user: User,
    problem: Problem,
    language: string,
    fileBuffer: Buffer,
    uploadedFileName: string,
    contestantId?: number,
    isPretest?: boolean,
  ) {
    try {
      const submission = await this.prismaService.submission.create({
        data: {
          authorId: user.id,
          problemId: problem.id,
          contestantId: contestantId,
          code: '[binary submission]',
          language: language,
          isPretest: isPretest || false,
          // Note: we intentionally do not store uploadedFileUrl/Name in DB.
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              fullname: true,
            },
          },
          problem: {
            select: {
              id: true,
              slug: true,
              name: true,
              points: true,
            },
          },
        },
      });

      // Upload file to S3 / Cloudflare R2 using submission ID as object key
      try {
        const bucket = process.env.STORAGE_ENDPOINT;
        const region = process.env.STORAGE_REGION || 'auto';
        const endpoint = process.env.STORAGE_ENDPOINT; // e.g., https://<account>.r2.cloudflarestorage.com
        const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
        const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;

        if (bucket && endpoint && accessKeyId && secretAccessKey) {
          const s3 = new S3Client({
            region,
            credentials: { accessKeyId, secretAccessKey },
            endpoint,
            forcePathStyle: false,
          });

          // Use submission ID as filename to guarantee uniqueness and easy lookup
          const key = `scratchCodes/${submission.id}.sb3`;

          // Upload the object to the private bucket
          await s3.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              Body: fileBuffer,
              ContentType: 'application/x.scratch.sb3',
            }),
          );

          // Generate a presigned GET URL valid for a short time (e.g., 15 minutes)
          const presignedUrl = await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: bucket, Key: key }),
            { expiresIn: 900 },
          );

          // Store presigned URL on the submission object in-memory response
          // Controllers can return it to the client immediately (not persisted in DB)
          // We attach it to the returned submission object for convenience
          (submission as any)._presignedUrl = presignedUrl;
        } else {
          this.logger.warn(
            'S3 credentials or bucket not configured; uploaded file not persisted to object storage',
          );
        }
      } catch (s3Err) {
        // Non-fatal: we still want the submission to exist even if upload fails
        this.logger.error('Failed to upload submission file to S3/R2', s3Err);
      }

      // Add to queue
      await this.queueService.addToQueue(submission.id);

      this.logger.log(
        `Submission ${submission.id} (file) created by user ${user.username} for problem ${problem.slug}`,
      );

      // Emit event for live updates
      this.eventEmitter.emit('submission.created', {
        submissionId: submission.id,
        authorId: user.id,
        problemId: problem.id,
        timestamp: new Date(),
      });

      return submission;
    } catch (err) {
      throw new InternalServerErrorException('UNKNOWN_ERROR', err);
    }
  }

  /**
   * Check if user can see test case data (input/output/expected)
   * Based on DMOJ's testcase visibility model
   */
  async canUserSeeTestcaseData(
    problem: {
      id: number;
      testcaseDataVisibility: TestcaseDataVisibility;
      authors: { id: string }[];
      curators: { id: string }[];
      testers: { id: string }[];
    },
    user?: User,
  ): Promise<boolean> {
    // If testcase data is visible to everyone
    if (problem.testcaseDataVisibility === TestcaseDataVisibility.EVERYONE) {
      return true;
    }

    // If user is not authenticated, they can't see restricted data
    if (!user) {
      return false;
    }

    if (
      user.perms &&
      this.permissionsService.hasPerms(
        user.perms,
        UserPermissions.EDIT_PROBLEM_TESTS,
      )
    ) {
      return true;
    }

    if (
      problem.testcaseDataVisibility === TestcaseDataVisibility.AC_ONLY &&
      (await this.problemsService.hasACProb(user, problem.id))
    )
      return true;

    // Check if user is author, curator, or tester
    if (problem.authors.some((author) => author.id === user.id)) return true;
    if (problem.curators.some((curator) => curator.id === user.id)) return true;
    if (problem.testers.some((tester) => tester.id === user.id)) return true;

    return false;
  }

  getViewableSubmissionWhereProblemQuery(user?: User) {
    if (!user) {
      return {
        isDeleted: false,
        isPublic: true,
      };
    }

    // If user has view all problems permissions, they can see all submissions
    if (this.problemsService.hasViewAllProbsPerms(user)) return {};

    // Otherwise, only view public submissions
    return {
      OR: [
        { isPublic: true, isDeleted: false },
        { authors: { some: { id: user.id } } },
        { curators: { some: { id: user.id } } },
        { testers: { some: { id: user.id } } },
      ],
    };
  }
}
