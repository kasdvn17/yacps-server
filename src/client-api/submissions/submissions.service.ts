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
