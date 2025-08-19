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
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PrismaService } from '@/prisma/prisma.service';
import { SubmissionQueueService } from '@/judge-api/submission-queue/submission-queue.service';
import { CreateSubmissionDTO, SubmissionQueryDTO } from './dto/submission.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggedInUser } from '../users/users.decorator';
import { User } from '@prisma/client';
import { Public } from '../auth/auth.decorator';
import { ProblemsService } from '../problems/problems.service';
import { SubmissionsService } from './submissions.service';

@Controller()
@UseGuards(AuthGuard)
export class SubmissionsController {
  private readonly logger = new Logger(SubmissionsController.name);

  constructor(
    private prisma: PrismaService,
    private queueService: SubmissionQueueService,
    private eventEmitter: EventEmitter2,
    private problemsService: ProblemsService,
    private submissionsService: SubmissionsService,
  ) {}

  @Post()
  async createSubmission(
    @Body() body: CreateSubmissionDTO,
    @LoggedInUser() user: User,
  ) {
    // Check if problem exists and is accessible
    const problem = await this.problemsService.findViewableProblemWithSlug(
      body.problemSlug,
    );

    if (!problem) {
      throw new NotFoundException('PROBLEM_NOT_FOUND');
    }

    // Check if language is supported for this problem
    const supportedLanguages = problem.testEnvironments?.allowedLangs || [];
    if (!supportedLanguages.includes(body.language)) {
      throw new BadRequestException('LANGUAGE_NOT_SUPPORTED');
    }

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

  @Get()
  @Public()
  async getSubmissions(@Query() query: SubmissionQueryDTO) {
    const { page = 1, limit = 20, ...filters } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(filters.authorId && { authorId: filters.authorId }),
      ...(filters.problemId && { problemId: filters.problemId }),
      ...(filters.contestantId && { contestantId: filters.contestantId }),
      ...(filters.verdict && { verdict: filters.verdict as any }),
    };

    const [submissions, total] = await Promise.all([
      this.prisma.submission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              fullname: true,
              rating: true,
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
          testCases: {
            select: {
              caseNumber: true,
              verdict: true,
              time: true,
              memory: true,
              points: true,
            },
          },
        },
        omit: {
          code: true,
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

  @Get(':id')
  async getSubmission(@Param('id') id: string) {
    const submissionId = parseInt(id, 10);
    if (isNaN(submissionId)) {
      throw new BadRequestException('INVALID_SUBMISSION');
    }

    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
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
          },
        },
        testCases: {
          orderBy: { caseNumber: 'asc' },
        },
        judge: {
          select: {
            id: true,
            name: true,
            host: true,
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('SUBMISSION_NOT_FOUND');
    }

    // Map feedback field for frontend compatibility
    const mappedSubmission = {
      ...submission,
      testCases: submission.testCases.map((testCase) => ({
        ...testCase,
        feedback: testCase.feedback, // Ensure feedback is passed through
      })),
    };

    return {
      success: true,
      data: mappedSubmission,
    };
  }

  @Get(':id/status')
  async getSubmissionStatus(@Param('id') id: string) {
    const submissionId = parseInt(id, 10);
    if (isNaN(submissionId)) {
      throw new BadRequestException('INVALID_SUBMISSION_ID');
    }

    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
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
            feedback: true,
          },
          orderBy: { caseNumber: 'asc' },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('SUBMISSION_NOT_FOUND');
    }

    return {
      success: true,
      data: submission,
    };
  }

  @Get('queue/status')
  async getQueueStatus() {
    const status = await this.queueService.getQueueStatus();
    return {
      success: true,
      data: status,
    };
  }
}
