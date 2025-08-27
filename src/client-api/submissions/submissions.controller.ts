import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PrismaService } from '@/prisma/prisma.service';
import { SubmissionQueueService } from '@/judge-api/submission-queue/submission-queue.service';
import { CreateSubmissionDTO, SubmissionQueryDTO } from './dto/submission.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggedInUser } from '../users/users.decorator';
import { SubmissionVerdict, User } from '@prisma/client';
import { Public } from '../auth/auth.decorator';
import { ProblemsService } from '../problems/problems.service';
import { SubmissionsService } from './submissions.service';
import { PermissionsService } from '../auth/permissions.service';
import { UserPermissions } from 'constants/permissions';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UsersService } from '../users/users.service';
// S3 upload handled in service

@Controller()
@UseGuards(AuthGuard)
export class SubmissionsController {
  private readonly logger = new Logger(SubmissionsController.name);

  constructor(
    private prisma: PrismaService,
    private queueService: SubmissionQueueService,
    private eventEmitter: EventEmitter2,
    private problemsService: ProblemsService,
    private usersService: UsersService,
    private submissionsService: SubmissionsService,
    private permissionsService: PermissionsService,
  ) {}

  // Multipart submission handler for file uploads (e.g., Scratch .sb3)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async uploadSubmission(
    @UploadedFile() file: any,
    @Body() body: any,
    @LoggedInUser() user: User,
  ) {
    // Basic validation: require problemSlug and language
    if (!body.problemSlug || !body.language)
      throw new BadRequestException('MISSING_FIELDS');

    // If no file buffer was sent, allow a presigned `uploadedFile` URL to be
    // provided by the frontend (e.g., when the client staged an .sb3 locally
    // or via a temporary upload proxy). We will create the submission and
    // attach the provided URL to the response (not persisted).
    if (!file && !body.uploadedFile) {
      throw new BadRequestException('NO_FILE');
    }

    const problem = await this.problemsService.findViewableProblemWithSlug(
      body.problemSlug,
      user,
    );
    if (!problem) throw new NotFoundException('PROBLEM_NOT_FOUND');

    const supportedLanguages = problem.testEnvironments?.allowedLangs || [];
    if (!supportedLanguages.includes(body.language)) {
      throw new BadRequestException('LANGUAGE_NOT_SUPPORTED');
    }

    let submission;
    if (file) {
      // Forward file buffer to the service; the service will create the submission
      // and upload the file to object storage using the submission ID as the key.
      submission = await this.submissionsService.createSubmissionWithFile(
        user,
        problem,
        body.language,
        file.buffer,
        file.originalname,
        body.contestantId,
        body.isPretest,
      );
    } else {
      // No buffer: use the provided presigned/external URL
      submission =
        await this.submissionsService.createSubmissionWithUploadedUrl(
          user,
          problem,
          body.language,
          body.uploadedFile,
          body.uploadedFileName,
          body.contestantId,
          body.isPretest,
        );
    }

    // Prefer the presigned URL returned by the service if available
    const presigned = submission?._presignedUrl;

    return {
      success: true,
      data: submission,
      url: presigned || null,
      name: file ? file.originalname : body.uploadedFileName || null,
    };
  }

  /**
   * Create a new submission for a problem
   * Validates problem existence, language support, and user permissions
   */
  @Post()
  async createSubmission(
    @Body() body: CreateSubmissionDTO,
    @LoggedInUser() user: User,
  ) {
    // Check if problem exists and is accessible
    const problem = await this.problemsService.findViewableProblemWithSlug(
      body.problemSlug,
      user,
    );

    if (!problem) {
      throw new NotFoundException('PROBLEM_NOT_FOUND');
    }

    // Check if language is supported for this problem
    const supportedLanguages = problem.testEnvironments?.allowedLangs || [];
    if (!supportedLanguages.includes(body.language)) {
      throw new BadRequestException('LANGUAGE_NOT_SUPPORTED');
    }

    if (!this.problemsService.viewableProblem(user, problem))
      throw new ForbiddenException('PROBLEM_NOT_VIEWABLE');
    if (problem.isLocked) throw new ForbiddenException('PROBLEM_LOCKED');

    const submission = await this.submissionsService.createSubmission(
      user,
      problem,
      body.code,
      body.language,
      body.contestantId,
      body.isPretest,
    );

    return {
      success: true,
      data: submission,
    };
  }

  /**
   * Get submissions with pagination and filtering
   * Supports filtering by author, problem, contestant, and verdict
   */
  @Get()
  @Public()
  async getSubmissions(
    @Query() query: SubmissionQueryDTO,
    @LoggedInUser() user?: User,
  ) {
    const { page = 1, limit = 20, ...filters } = query;
    const skip = (page - 1) * limit;

    if (filters.verdict && !(filters.verdict in SubmissionVerdict))
      throw new BadRequestException('INVALID_VERDICT');

    const where: any = {
      ...(filters.problemSlug && { problem: { slug: filters.problemSlug } }),
      ...(filters.authorId && { authorId: filters.authorId }),
      ...(filters.problemId && { problemId: filters.problemId }),
      ...(filters.contestantId && { contestantId: filters.contestantId }),
      ...(filters.verdict && { verdict: filters.verdict as SubmissionVerdict }),
      // Only show submissions with viewable problems
      problem:
        this.submissionsService.getViewableSubmissionWhereProblemQuery(user),
    };

    const [submissions, total] = await Promise.all([
      this.prisma.submission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          author: {
            select: {
              username: true,
              fullname: true,
              rating: true,
            },
          },
          problem: {
            select: {
              slug: true,
              name: true,
              points: true,
            },
          },
          id: true,
          language: true,
          verdict: true,
          points: true,
          maxTime: true,
          maxMemory: true,
          createdAt: true,
        },
      }),
      this.prisma.submission.count({ where }),
    ]);

    return {
      success: true,
      data: submissions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a specific submission by ID
   * Includes author, problem details, and test cases
   * Handles permissions for viewing test case data
   */
  @Get(':id')
  @Public()
  async getSubmission(@Param('id') id: string, @LoggedInUser() user?: User) {
    const submissionId = parseInt(id, 10);
    if (isNaN(submissionId)) {
      throw new BadRequestException('INVALID_SUBMISSION');
    }

    const hasViewCodePerms = this.permissionsService.hasPerms(
      user?.perms || 0n,
      UserPermissions.VIEW_SUBMISSION_CODE,
    );

    const submission = await this.prisma.submission.findUnique({
      where: {
        id: submissionId,
        problem:
          this.submissionsService.getViewableSubmissionWhereProblemQuery(user),
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
            testEnvironments: true,
            testcaseDataVisibility: true,
            isPublic: true,
            isDeleted: true,
            authors: { select: { id: true } },
            curators: { select: { id: true } },
            testers: { select: { id: true } },
          },
        },
        judge: {
          select: {
            name: true,
          },
        },
        testCases: {
          orderBy: { caseNumber: 'asc' },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('SUBMISSION_NOT_FOUND');
    }

    if (!this.problemsService.viewableProblem(user, submission.problem))
      throw new ForbiddenException('SUBMISSION_NOT_VIEWABLE');

    if (
      submission?.authorId !== user?.id &&
      !hasViewCodePerms &&
      submission?.code
    )
      submission.code = '';

    // Check if user can see test case data (input/output/expected)
    const canSeeTestcaseData =
      await this.submissionsService.canUserSeeTestcaseData(
        submission.problem,
        user,
      );

    // Get problem test cases if user has permission to see test case data
    let problemTestCases: any[] = [];
    if (canSeeTestcaseData) {
      problemTestCases = await this.prisma.problemTestCase.findMany({
        where: {
          problemId: submission.problem.id,
          isDeleted: false,
        },
        orderBy: { caseNumber: 'asc' },
      });
    }

    // Redact problem moderators for privacy
    submission.problem.authors = [];
    submission.problem.curators = [];
    submission.problem.testers = [];

    // Map feedback field for frontend compatibility and merge with problem test case data
    const mappedSubmission = {
      ...submission,
      testCases: submission.testCases.map((testCase) => {
        // Find matching problem test case for input/expected data (fallback)
        const problemTestCase = problemTestCases.find(
          (ptc) => ptc.caseNumber === testCase.caseNumber,
        );

        return {
          ...testCase,
          batchNumber: (testCase as any).batchNumber ?? null,
          input: canSeeTestcaseData
            ? testCase.input || problemTestCase?.input
            : undefined,
          output: canSeeTestcaseData ? testCase.output : undefined,
          expected: canSeeTestcaseData
            ? testCase.expected || problemTestCase?.expected
            : undefined,
        };
      }),
    };

    // If this is a SCRATCH submission, attempt to generate a presigned GET URL
    // for the private object in R2 and attach it to the returned object so
    // the frontend can present a download link. This URL is not persisted.
    if (mappedSubmission.language === 'SCRATCH') {
      try {
        const bucket = process.env.STORAGE_BUCKET;
        const region = process.env.STORAGE_REGION || 'auto';
        const endpoint = process.env.STORAGE_ENDPOINT;
        const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
        const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;

        if (bucket && endpoint && accessKeyId && secretAccessKey) {
          const s3 = new S3Client({
            region,
            credentials: { accessKeyId, secretAccessKey },
            endpoint,
            forcePathStyle: false,
          });

          const key = `scratchCodes/${mappedSubmission.id}.sb3`;
          const presigned = await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: bucket, Key: key }),
            { expiresIn: 900 },
          );

          (mappedSubmission as any).uploadedFileUrl = presigned;
        }
      } catch (err) {
        this.logger.warn(
          'Failed to generate presigned URL for submission',
          err,
        );
      }
    }

    return {
      success: true,
      data: mappedSubmission,
    };
  }

  /**
   * Get the status of a specific submission
   * Includes verdict, points, time, memory, and test case results
   */
  @Get(':id/status')
  @Public()
  async getSubmissionStatus(
    @Param('id') id: string,
    @LoggedInUser() user?: User,
  ) {
    const submissionId = parseInt(id, 10);
    if (isNaN(submissionId)) {
      throw new BadRequestException('INVALID_SUBMISSION');
    }

    const submission: any = await this.prisma.submission.findUnique({
      where: {
        id: submissionId,
        problem:
          this.submissionsService.getViewableSubmissionWhereProblemQuery(user),
      },
      select: {
        id: true,
        verdict: true,
        points: true,
        maxTime: true,
        maxMemory: true,
        queuedAt: true,
        judgingStartedAt: true,
        judgingEndedAt: true,
        errorMessage: true,
        testCases: {
          select: {
            caseNumber: true,
            verdict: true,
            time: true,
            memory: true,
            points: true,
            batchNumber: true,
            feedback: true,
          },
          orderBy: { caseNumber: 'asc' },
        },
        problem: {
          select: {
            isPublic: true,
            isDeleted: true,
            authors: {
              select: { id: true },
            },
            curators: {
              select: { id: true },
            },
            testers: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('SUBMISSION_NOT_FOUND');
    }
    if (!this.problemsService.viewableProblem(user, submission.problem))
      throw new ForbiddenException('SUBMISSION_NOT_VIEWABLE');
    delete submission.problem; // Redact problem moderators for privacy
    return {
      success: true,
      data: submission,
    };
  }

  @Get('heatmap/:username')
  @Public()
  async getUserSubmissionsHeatmap(@Param('username') username: string) {
    const user = await this.usersService.findUser({ username }, false, false);
    if (!user) throw new NotFoundException('USER_NOT_FOUND');

    const submissions = (
      await this.prisma.submission.findMany({
        where: { authorId: user.id },
        select: { createdAt: true },
      })
    ).map((v) => ({
      timestamp: v.createdAt.getTime(),
    }));
    return submissions;
  }

  /**
   * Get the current status of the submission queue
   * Returns number of submissions in queue, processing, and total
   */
  @Get('queue/status')
  async getQueueStatus() {
    const status = await this.queueService.getQueueStatus();
    return {
      success: true,
      data: status,
    };
  }
}
