import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { SubmissionQueueService } from '../submission-queue/submission-queue.service';
import { DMOJBridgeService } from '../dmoj-bridge/dmoj-bridge.service';
import { SubmissionVerdict } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class JudgeManagerService implements OnModuleInit {
  private readonly logger = new Logger(JudgeManagerService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: SubmissionQueueService,
    private dmojBridge: DMOJBridgeService,
    private eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    // Connect to all active judges on startup
    await this.connectToAllJudges();

    // Start the queue processor
    void this.processQueue();
  }

  /**
   * Initialize judge connections (now passive - judges connect to us)
   */
  async connectToAllJudges(): Promise<void> {
    const judges = await this.prisma.judge.findMany({
      where: {
        status: 'ACTIVE',
        isDeleted: false,
      },
    });

    this.logger.log(
      `Found ${judges.length} active judges. They should connect to our TCP server.`,
    );

    // No longer actively connecting - judges connect to our TCP server
    // The DMOJ bridge service will handle incoming connections
  }

  /**
   * Process the submission queue
   */
  @Cron(CronExpression.EVERY_5_SECONDS)
  async processQueue(): Promise<void> {
    try {
      // Get next submission from queue
      const queueEntry = await this.queueService.getNextSubmission();
      if (!queueEntry) {
        return;
      }

      // Get connected judges directly from DMOJ bridge (no database check needed)
      const connectedJudgeNames = this.dmojBridge.getConnectedJudges();

      this.logger.debug(
        `Connected judges from DMOJ: ${connectedJudgeNames.length}`,
      );
      this.logger.debug(`Connected judges: ${connectedJudgeNames.join(', ')}`);

      if (connectedJudgeNames.length === 0) {
        this.logger.debug('No connected judges, skipping queue processing');
        return;
      }

      // Select first available judge (simple approach)
      const selectedJudgeName = connectedJudgeNames[0];

      // Get the judge database record to get the ID for the queue assignment
      const judgeRecord = await this.prisma.judge.findFirst({
        where: { name: selectedJudgeName },
      });

      if (!judgeRecord) {
        this.logger.error(`Judge ${selectedJudgeName} not found in database`);
        return;
      }

      // Assign submission to judge (using database ID for foreign key constraint)
      await this.queueService.assignToJudge(queueEntry.id, judgeRecord.id);

      // Send submission to DMOJ bridge
      const submissionData = {
        id: queueEntry.submission.id,
        problem: queueEntry.submission.problem.slug,
        language: queueEntry.submission.language,
        source: queueEntry.submission.code,
        time_limit:
          queueEntry.submission.problem.testEnvironments?.timeLimit || 1, // in seconds
        memory_limit:
          (queueEntry.submission.problem.testEnvironments?.memoryLimit || 256) *
          1024, // convert MB to KB
      };

      // Get the connection ID for this judge by name
      const connectionId =
        this.dmojBridge.getConnectionIdForJudgeName(selectedJudgeName);
      if (!connectionId) {
        this.logger.error(
          `No connection ID found for judge ${selectedJudgeName}`,
        );
        await this.queueService.failSubmission(
          queueEntry.submission.id,
          'Judge connection not found',
        );
        return;
      }

      const success = this.dmojBridge.submitToJudge(
        connectionId,
        submissionData,
      );

      if (!success) {
        await this.queueService.failSubmission(
          queueEntry.submission.id,
          'Failed to send submission to judge',
        );
      } else {
        this.logger.log(
          `Submission ${queueEntry.submission.id} sent to judge ${selectedJudgeName}`,
        );
      }
    } catch (error) {
      this.logger.error('Error processing queue:', error);
    }
  }

  /**
   * Handle judge authentication events
   */
  @OnEvent('judge.authenticated')
  async handleJudgeAuthenticated(data: {
    connectionId: string;
    judgeId: string;
    judgeName: string;
    judge: any;
    data: any;
  }) {
    this.logger.log(
      `Judge ${data.judgeName} (${data.connectionId}) authenticated successfully`,
    );

    // Update judge last active time
    await this.prisma.judge.update({
      where: { id: data.judgeId },
      data: { lastActive: new Date() },
    });

    // Emit event for WebSocket clients
    this.eventEmitter.emit('judge.status-update', {
      judgeId: data.judgeId,
      judgeName: data.judgeName,
      connectionId: data.connectionId,
      status: 'connected',
      timestamp: new Date(),
    });
  }

  /**
   * Handle compilation errors
   */
  @OnEvent('submission.compile-error')
  async handleCompileError(data: {
    judgeId: string;
    submissionId: number;
    error: string;
  }) {
    this.logger.debug(`Compile error for submission ${data.submissionId}`);

    await this.queueService.completeSubmission(
      data.submissionId,
      SubmissionVerdict.CE,
      { errorMessage: data.error },
    );

    // Emit event for WebSocket clients
    this.eventEmitter.emit('submission.update', {
      submissionId: data.submissionId,
      verdict: SubmissionVerdict.CE,
      errorMessage: data.error,
      timestamp: new Date(),
    });
  }

  /**
   * Handle grading start
   */
  @OnEvent('submission.begin-grading')
  async handleBeginGrading(data: {
    judgeId: string;
    submissionId: number;
    isPretest: boolean;
  }) {
    this.logger.debug(`Begin grading submission ${data.submissionId}`);

    // Update submission in database
    await this.prisma.submission.update({
      where: { id: data.submissionId },
      data: {
        verdict: SubmissionVerdict.RN,
        isPretest: data.isPretest,
      },
    });

    // Emit event for WebSocket clients
    this.eventEmitter.emit('submission.update', {
      submissionId: data.submissionId,
      verdict: SubmissionVerdict.RN,
      isPretest: data.isPretest,
      timestamp: new Date(),
    });
  }

  /**
   * Handle test case results
   */
  @OnEvent('submission.test-case-status')
  async handleTestCaseStatus(data: {
    judgeId: string;
    submissionId: number;
    caseNumber: number;
    batchNumber?: number;
    status: string;
    time?: number;
    memory?: number;
    points?: number;
    totalPoints?: number;
    feedback?: string;
    output?: string;
    expected?: string;
  }) {
    this.logger.debug(
      `Test case ${data.caseNumber} for submission ${data.submissionId}: status=${data.status}`,
    );

    // Map DMOJ status to our verdict enum
    const verdict = this.mapDMOJStatusToVerdict(Number(data.status));

    this.logger.debug(
      `DMOJ status ${data.status} mapped to verdict: ${verdict}`,
    );

    // Store test case result
    await this.prisma.submissionTestCase.upsert({
      where: {
        submissionId_caseNumber: {
          submissionId: data.submissionId,
          caseNumber: data.caseNumber,
        },
      },
      update: {
        verdict,
        time: data.time,
        memory: data.memory ? Math.round(data.memory) : null,
        points: data.points,
        maxPoints: data.totalPoints,
        feedback: data.feedback,
        output: data.output,
        expected: data.expected,
        batchNumber: data.batchNumber,
      },
      create: {
        submissionId: data.submissionId,
        caseNumber: data.caseNumber,
        batchNumber: data.batchNumber,
        verdict,
        time: data.time,
        memory: data.memory ? Math.round(data.memory) : null,
        points: data.points || 0,
        maxPoints: data.totalPoints || 0,
        feedback: data.feedback,
        output: data.output,
        expected: data.expected,
      },
    });

    // Emit event for WebSocket clients
    this.eventEmitter.emit('submission.test-case-update', {
      submissionId: data.submissionId,
      caseNumber: data.caseNumber,
      batchNumber: data.batchNumber,
      verdict,
      time: data.time,
      memory: data.memory,
      points: data.points,
      totalPoints: data.totalPoints,
      feedback: data.feedback,
      timestamp: new Date(),
    });
  }

  /**
   * Handle grading completion
   */
  @OnEvent('submission.grading-end')
  async handleGradingEnd(data: { judgeId: string; submissionId: number }) {
    this.logger.debug(`Grading completed for submission ${data.submissionId}`);

    // Get submission with problem info for points calculation
    const submission = await this.prisma.submission.findUnique({
      where: { id: data.submissionId },
      include: {
        problem: {
          select: {
            points: true,
          },
        },
      },
    });

    if (!submission) {
      this.logger.error(`Submission ${data.submissionId} not found`);
      return;
    }

    // Calculate final result from test cases
    const testCases = await this.prisma.submissionTestCase.findMany({
      where: { submissionId: data.submissionId },
    });

    // Determine final verdict and calculate stats
    let finalVerdict: SubmissionVerdict = SubmissionVerdict.AC;
    let casePoints = 0;
    let caseTotal = 0;
    let maxTime = 0;
    let maxMemory = 0;

    // Verdict priority order (higher number = higher priority = worse verdict)
    const verdictPriority = {
      [SubmissionVerdict.AC]: 0,
      [SubmissionVerdict.SK]: 0, // Skipped doesn't affect verdict
      [SubmissionVerdict.WA]: 1,
      [SubmissionVerdict.IR]: 2,
      [SubmissionVerdict.OLE]: 3,
      [SubmissionVerdict.MLE]: 4,
      [SubmissionVerdict.TLE]: 5,
      [SubmissionVerdict.RTE]: 6,
      [SubmissionVerdict.CE]: 7,
      [SubmissionVerdict.ISE]: 8,
      [SubmissionVerdict.AB]: 9,
    };

    for (const testCase of testCases) {
      casePoints += testCase.points || 0;
      caseTotal += testCase.maxPoints || 0;
      maxTime = Math.max(maxTime, testCase.time || 0);
      maxMemory = Math.max(maxMemory, testCase.memory || 0);

      // Update final verdict to the worst non-skipped verdict
      if (testCase.verdict !== SubmissionVerdict.SK) {
        const currentPriority = verdictPriority[finalVerdict] || 0;
        const testCasePriority = verdictPriority[testCase.verdict] || 0;

        if (testCasePriority > currentPriority) {
          finalVerdict = testCase.verdict;
        }
      }
    }

    // Calculate final submission points using DMOJ's formula
    // submission.points = (case_points / case_total) * problem.points
    let submissionPoints = 0;
    if (caseTotal > 0) {
      submissionPoints =
        Math.round(
          (casePoints / caseTotal) * submission.problem.points * 1000,
        ) / 1000; // Round to 3 decimal places like DMOJ
    }

    // Note: This system currently allows partial scoring by default
    // In DMOJ, non-partial problems would set submissionPoints = 0 if not full score
    // You can add a 'partial' field to Problem model to implement this feature

    // Complete submission
    this.logger.debug(
      `Final verdict for submission ${data.submissionId}: ${finalVerdict} (${casePoints}/${caseTotal} → ${submissionPoints}/${submission.problem.points})`,
    );

    await this.queueService.completeSubmission(
      data.submissionId,
      finalVerdict,
      {
        points: submissionPoints,
        maxMemory: maxMemory > 0 ? maxMemory : undefined,
        maxTime: maxTime > 0 ? maxTime : undefined,
      },
    );

    // Emit event for WebSocket clients
    this.eventEmitter.emit('submission.update', {
      submissionId: data.submissionId,
      verdict: finalVerdict,
      points: submissionPoints,
      maxPoints: caseTotal,
      maxTime,
      maxMemory,
      timestamp: new Date(),
    });
  }

  /**
   * Handle submission abortion
   */
  @OnEvent('submission.aborted')
  async handleSubmissionAborted(data: {
    judgeId: string;
    submissionId: number;
  }) {
    this.logger.debug(`Submission ${data.submissionId} was aborted`);

    await this.queueService.completeSubmission(
      data.submissionId,
      SubmissionVerdict.AB,
    );

    // Emit event for WebSocket clients
    this.eventEmitter.emit('submission.update', {
      submissionId: data.submissionId,
      verdict: SubmissionVerdict.AB,
      timestamp: new Date(),
    });
  }

  /**
   * Handle submission acknowledgment
   */
  @OnEvent('submission.acknowledged')
  handleSubmissionAcknowledged(data: {
    judgeId: string;
    submissionId: number;
  }) {
    this.logger.log(
      `✅ Submission ${data.submissionId} acknowledged by judge ${data.judgeId}`,
    );

    // Emit event for WebSocket clients to show that submission is being processed
    this.eventEmitter.emit('submission.update', {
      submissionId: data.submissionId,
      status: 'ACKNOWLEDGED',
      timestamp: new Date(),
    });
  }

  /**
   * Map DMOJ status to our submission verdict enum
   * Based on dmoj/result.py - DMOJ uses bit flags that can be combined
   */
  private mapDMOJStatusToVerdict(status: number): SubmissionVerdict {
    // DMOJ result status bit flags from dmoj/result.py
    const DMOJ_STATUS = {
      AC: 0, // Accepted
      WA: 1 << 0, // Wrong Answer = 1
      RTE: 1 << 1, // Runtime Error = 2
      TLE: 1 << 2, // Time Limit Exceeded = 4
      MLE: 1 << 3, // Memory Limit Exceeded = 8
      IR: 1 << 4, // Invalid Return = 16
      SC: 1 << 5, // Short Circuit/Skipped = 32
      OLE: 1 << 6, // Output Limit Exceeded = 64
      IE: 1 << 30, // Internal Error = 1073741824
    };

    // Priority order from DMOJ CODE_DISPLAY_ORDER: ('IE', 'TLE', 'MLE', 'OLE', 'RTE', 'IR', 'WA', 'SC')
    // Check in priority order - return the first matching flag
    if (status & DMOJ_STATUS.IE) return SubmissionVerdict.ISE;
    if (status & DMOJ_STATUS.TLE) return SubmissionVerdict.TLE;
    if (status & DMOJ_STATUS.MLE) return SubmissionVerdict.MLE;
    if (status & DMOJ_STATUS.OLE) return SubmissionVerdict.OLE;
    if (status & DMOJ_STATUS.RTE) return SubmissionVerdict.RTE;
    if (status & DMOJ_STATUS.IR) return SubmissionVerdict.IR;
    if (status & DMOJ_STATUS.WA) return SubmissionVerdict.WA;
    if (status & DMOJ_STATUS.SC) return SubmissionVerdict.SK; // Skipped

    // If no flags are set, it's AC
    return status === 0 ? SubmissionVerdict.AC : SubmissionVerdict.ISE;
  }

  /**
   * Get judge status
   */
  async getJudgeStatus() {
    const judges = await this.prisma.judge.findMany({
      where: { isDeleted: false },
      include: {
        _count: {
          select: { submissions: true },
        },
      },
    });

    return judges.map((judge) => ({
      ...judge,
      isConnected: this.dmojBridge.isJudgeConnected(judge.name),
      submissionCount: judge._count.submissions,
    }));
  }

  /**
   * Manually trigger queue processing
   */
  async triggerQueueProcessing(): Promise<void> {
    await this.processQueue();
  }
}
