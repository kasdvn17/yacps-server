import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  Judge,
  Submission,
  SubmissionQueue,
  SubmissionVerdict,
} from '@prisma/client';

@Injectable()
export class SubmissionQueueService {
  private readonly logger = new Logger(SubmissionQueueService.name);

  constructor(private prisma: PrismaService) {}

  async addToQueue(
    submissionId: number,
    priority: number = 0,
  ): Promise<SubmissionQueue> {
    this.logger.debug(
      `Adding submission ${submissionId} to queue with priority ${priority}`,
    );

    const queueEntry = await this.prisma.submissionQueue.create({
      data: {
        submissionId,
        priority,
      },
      include: {
        submission: {
          include: {
            problem: true,
            author: true,
          },
        },
      },
    });

    // Update submission status to queued
    await this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        verdict: SubmissionVerdict.QU,
        queuedAt: new Date(),
      },
    });

    this.logger.log(`Submission ${submissionId} added to queue`);
    return queueEntry;
  }

  async getNextSubmission(): Promise<
    | (SubmissionQueue & {
        submission: Submission & { problem: any; author: any };
      })
    | null
  > {
    const nextSubmission = await this.prisma.submissionQueue.findFirst({
      where: {
        assignedJudgeId: null,
        attempts: {
          lt: 3, // max attempts
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: {
        submission: {
          include: {
            problem: {
              include: {
                testEnvironments: true,
              },
            },
            author: true,
          },
        },
      },
    });

    return nextSubmission;
  }

  async assignToJudge(
    queueId: number,
    judgeId: string,
  ): Promise<SubmissionQueue> {
    this.logger.debug(`Assigning queue entry ${queueId} to judge ${judgeId}`);

    const result = await this.prisma.submissionQueue.update({
      where: { id: queueId },
      data: {
        assignedJudgeId: judgeId,
        assignedAt: new Date(),
        attempts: {
          increment: 1,
        },
      },
      include: {
        submission: true,
      },
    });

    // Update judge status
    await this.prisma.judge.update({
      where: { id: judgeId },
      data: {
        isJudging: true,
        currentSubmissionId: result.submissionId,
        lastActive: new Date(),
      },
    });

    // Update submission status
    await this.prisma.submission.update({
      where: { id: result.submissionId },
      data: {
        verdict: SubmissionVerdict.RN,
        judgeId,
        judgingStartedAt: new Date(),
      },
    });

    this.logger.log(
      `Submission ${result.submissionId} assigned to judge ${judgeId}`,
    );
    return result;
  }

  async completeSubmission(
    submissionId: number,
    verdict: SubmissionVerdict,
    details?: {
      points?: number;
      maxMemory?: number;
      maxTime?: number;
      errorMessage?: string;
    },
  ): Promise<void> {
    this.logger.debug(
      `Completing submission ${submissionId} with verdict ${verdict}`,
    );

    // Update submission
    await this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        verdict,
        judgingEndedAt: new Date(),
        points: details?.points,
        maxMemory: details?.maxMemory,
        maxTime: details?.maxTime,
        errorMessage: details?.errorMessage,
      },
    });

    // Remove from queue
    await this.prisma.submissionQueue.delete({
      where: { submissionId },
    });

    // Free up judge
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { judgeId: true },
    });

    if (submission?.judgeId) {
      await this.prisma.judge.update({
        where: { id: submission.judgeId },
        data: {
          isJudging: false,
          currentSubmissionId: null,
          lastActive: new Date(),
        },
      });
    }

    this.logger.log(
      `Submission ${submissionId} completed with verdict ${verdict}`,
    );
  }

  async failSubmission(submissionId: number, error: string): Promise<void> {
    this.logger.warn(`Failing submission ${submissionId}: ${error}`);

    const queueEntry = await this.prisma.submissionQueue.findUnique({
      where: { submissionId },
    });

    if (!queueEntry) {
      this.logger.error(`Queue entry not found for submission ${submissionId}`);
      return;
    }

    if (queueEntry.attempts >= queueEntry.maxAttempts) {
      // Max attempts reached, mark as failed
      await this.completeSubmission(submissionId, SubmissionVerdict.ISE, {
        errorMessage: `Failed after ${queueEntry.attempts} attempts: ${error}`,
      });
    } else {
      // Reset assignment for retry
      await this.prisma.submissionQueue.update({
        where: { id: queueEntry.id },
        data: {
          assignedJudgeId: null,
          assignedAt: null,
        },
      });

      // Free up judge if assigned
      if (queueEntry.assignedJudgeId) {
        await this.prisma.judge.update({
          where: { id: queueEntry.assignedJudgeId },
          data: {
            isJudging: false,
            currentSubmissionId: null,
            lastActive: new Date(),
          },
        });
      }

      // Reset submission status
      await this.prisma.submission.update({
        where: { id: submissionId },
        data: {
          verdict: SubmissionVerdict.QU,
          judgeId: null,
          judgingStartedAt: null,
        },
      });
    }
  }

  async getAvailableJudges(): Promise<Judge[]> {
    return this.prisma.judge.findMany({
      where: {
        status: 'ACTIVE',
        isDeleted: false,
        isJudging: false,
        lastActive: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // Last active within 5 minutes
        },
      },
    });
  }

  async getQueueStatus(): Promise<{
    queued: number;
    judging: number;
    availableJudges: number;
  }> {
    const [queued, judging, availableJudges] = await Promise.all([
      this.prisma.submissionQueue.count({
        where: { assignedJudgeId: null },
      }),
      this.prisma.submissionQueue.count({
        where: { assignedJudgeId: { not: null } },
      }),
      this.getAvailableJudges().then((judges) => judges.length),
    ]);

    return { queued, judging, availableJudges };
  }
}
