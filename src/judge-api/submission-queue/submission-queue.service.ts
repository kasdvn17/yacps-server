import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { DMOJBridgeService } from '../dmoj-bridge/dmoj-bridge.service';
import {
  Judge,
  Submission,
  SubmissionQueue,
  SubmissionVerdict,
} from '@prisma/client';

@Injectable()
export class SubmissionQueueService {
  private readonly logger = new Logger(SubmissionQueueService.name);
  private readonly busyJudges = new Set<string>(); // Track judges currently processing submissions
  private lastUsedJudgeIndex = 0; // Track last used judge for round-robin

  constructor(
    private prisma: PrismaService,
    private dmojBridge: DMOJBridgeService,
  ) {}

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

  // Track submissions currently being processed to avoid duplicate processing
  private readonly processingSubmissions = new Set<number>();

  async getNextSubmission(): Promise<
    | (SubmissionQueue & {
        submission: Submission & { problem: any; author: any };
      })
    | null
  > {
    const nextSubmission = await this.prisma.submissionQueue.findFirst({
      where: {
        attempts: {
          lt: 3, // max attempts
        },
        submissionId: {
          notIn: Array.from(this.processingSubmissions), // Exclude already processing submissions
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
    judgeName: string,
  ): Promise<SubmissionQueue | null> {
    // Check if judge is already busy
    if (this.busyJudges.has(judgeName)) {
      this.logger.debug(`Judge ${judgeName} is already busy`);
      return null;
    }

    this.logger.debug(`Assigning queue entry ${queueId} to judge ${judgeName}`);

    // Mark judge as busy
    this.busyJudges.add(judgeName);

    try {
      const result = await this.prisma.submissionQueue.update({
        where: { id: queueId },
        data: {
          attempts: {
            increment: 1,
          },
        },
        include: {
          submission: true,
        },
      });

      // Mark submission as being processed
      this.processingSubmissions.add(result.submissionId);

      // Update submission status
      await this.prisma.submission.update({
        where: { id: result.submissionId },
        data: {
          verdict: SubmissionVerdict.RN,
          judgingStartedAt: new Date(),
        },
      });

      this.logger.log(
        `Submission ${result.submissionId} assigned to judge ${judgeName}`,
      );
      return result;
    } catch (error) {
      // If assignment fails, remove judge from busy set
      this.busyJudges.delete(judgeName);
      throw error;
    }
  }

  async completeSubmission(
    submissionId: number,
    judgeName: string,
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

    const judgeDbId = this.dmojBridge.getJudgeIdFromName(judgeName);

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
        ...(judgeDbId && { judgeId: judgeDbId }), // Only set judgeId if it exists
      },
    });

    // Remove from queue
    await this.prisma.submissionQueue.delete({
      where: { submissionId },
    });

    // Free up judge (remove from busy set)
    this.busyJudges.delete(judgeName);

    // Remove from processing set
    this.processingSubmissions.delete(submissionId);

    this.logger.log(
      `Submission ${submissionId} completed with verdict ${verdict}, judge ${judgeName} freed`,
    );
  }

  async failSubmission(
    submissionId: number,
    judgeName: string,
    error: string,
  ): Promise<void> {
    this.logger.warn(`Failing submission ${submissionId}: ${error}`);

    const queueEntry = await this.prisma.submissionQueue.findUnique({
      where: { submissionId },
    });

    if (!queueEntry) {
      this.logger.error(`Queue entry not found for submission ${submissionId}`);
      // Still free up the judge and submission in case it was assigned
      this.busyJudges.delete(judgeName);
      this.processingSubmissions.delete(submissionId);
      return;
    }

    if (queueEntry.attempts >= queueEntry.maxAttempts) {
      // Max attempts reached, mark as failed
      await this.completeSubmission(
        submissionId,
        judgeName,
        SubmissionVerdict.ISE,
        {
          errorMessage: `Failed after ${queueEntry.attempts} attempts: ${error}`,
        },
      );
    } else {
      // Free up judge and submission for retry
      this.busyJudges.delete(judgeName);
      this.processingSubmissions.delete(submissionId);

      // Reset submission status for retry
      await this.prisma.submission.update({
        where: { id: submissionId },
        data: {
          verdict: SubmissionVerdict.QU,
          judgingStartedAt: null,
        },
      });

      this.logger.log(
        `Submission ${submissionId} reset for retry, judge ${judgeName} freed`,
      );
    }
  }

  getAvailableJudges(): string[] {
    // Get actually connected judges from DMOJ bridge
    const connectedJudgeNames = this.dmojBridge.getConnectedJudges();

    // Filter out busy judges and sort to ensure consistent ordering
    // Sort alphabetically to avoid bias towards recently connected judges
    return connectedJudgeNames
      .filter((judgeName) => !this.busyJudges.has(judgeName))
      .sort(); // Alphabetical sorting for deterministic order
  }

  getNextAvailableJudge(): string | null {
    const availableJudges = this.getAvailableJudges();

    if (availableJudges.length === 0) {
      return null;
    }

    // Implement round-robin assignment to distribute load evenly
    // This prevents always assigning to the same judge (usually the newest one)
    if (this.lastUsedJudgeIndex >= availableJudges.length) {
      this.lastUsedJudgeIndex = 0; // Reset if index is out of bounds
    }

    const selectedJudge = availableJudges[this.lastUsedJudgeIndex];
    this.lastUsedJudgeIndex =
      (this.lastUsedJudgeIndex + 1) % availableJudges.length;

    this.logger.debug(
      `Selected judge ${selectedJudge} (${
        this.lastUsedJudgeIndex - 1
      }/${availableJudges.length - 1}) via round-robin`,
    );

    return selectedJudge;
  }

  async getAvailableJudgesWithDetails(): Promise<Judge[]> {
    const availableJudgeNames = this.getAvailableJudges();

    if (availableJudgeNames.length === 0) {
      return [];
    }

    // Get judge details from database for the available judges
    return this.prisma.judge.findMany({
      where: {
        name: {
          in: availableJudgeNames,
        },
        status: 'ACTIVE',
        isDeleted: false,
      },
    });
  }

  isJudgeBusy(judgeName: string): boolean {
    return this.busyJudges.has(judgeName);
  }

  getBusyJudgesCount(): number {
    return this.busyJudges.size;
  }

  getProcessingSubmissionsCount(): number {
    return this.processingSubmissions.size;
  }

  isSubmissionBeingProcessed(submissionId: number): boolean {
    return this.processingSubmissions.has(submissionId);
  }

  async getQueueStatus(): Promise<{
    queued: number;
    judging: number;
    availableJudges: number;
    totalConnectedJudges: number;
    processingSubmissions: number;
    availableJudgeNames: string[];
    busyJudgeNames: string[];
    lastUsedJudgeIndex: number;
  }> {
    const queued = await this.prisma.submissionQueue.count();

    const allConnectedJudges = this.dmojBridge.getConnectedJudges();
    const availableJudgeNames = this.getAvailableJudges();
    const busyJudgeNames = Array.from(this.busyJudges);

    const totalConnectedJudges = allConnectedJudges.length;
    const judging = this.busyJudges.size;
    const availableJudges = availableJudgeNames.length;
    const processingSubmissions = this.processingSubmissions.size;

    return {
      queued,
      judging,
      availableJudges,
      totalConnectedJudges,
      processingSubmissions,
      availableJudgeNames,
      busyJudgeNames,
      lastUsedJudgeIndex: this.lastUsedJudgeIndex,
    };
  }
}
