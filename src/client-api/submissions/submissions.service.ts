import { SubmissionQueueService } from '@/judge-api/submission-queue/submission-queue.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Problem, User } from '@prisma/client';

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    private prismaService: PrismaService,
    private queueService: SubmissionQueueService,
    private eventEmitter: EventEmitter2,
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
}
