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

      // Get available judges
      const availableJudges = await this.queueService.getAvailableJudges();
      const connectedJudges = availableJudges.filter((judge) => {
        const isConnected = this.dmojBridge.isDatabaseJudgeConnected(judge.id);
        this.logger.debug(
          `Judge ${judge.name} (ID: ${judge.id}) connected: ${isConnected}`,
        );
        return isConnected;
      });

      this.logger.debug(`Available judges from DB: ${availableJudges.length}`);
      this.logger.debug(
        `Connected judges from DMOJ: ${connectedJudges.length}`,
      );

      if (availableJudges.length > 0) {
        this.logger.debug(
          `Available judges: ${availableJudges.map((j) => `${j.name}(${j.status})`).join(', ')}`,
        );
      }

      if (connectedJudges.length === 0) {
        this.logger.debug('No available judges, skipping queue processing');
        return;
      }

      // Select a judge (simple round-robin for now)
      const selectedJudge = connectedJudges[0];

      // Assign submission to judge
      await this.queueService.assignToJudge(queueEntry.id, selectedJudge.id);

      // Send submission to DMOJ bridge
      const submissionData = {
        id: queueEntry.submission.id,
        problem: queueEntry.submission.problem.slug,
        language: queueEntry.submission.language,
        source: queueEntry.submission.code,
        time_limit:
          queueEntry.submission.problem.testEnvironments?.timeLimit || 1,
        memory_limit:
          queueEntry.submission.problem.testEnvironments?.memoryLimit || 256,
      };

      // Get the connection ID for this judge
      const connectionId = this.dmojBridge.getConnectionIdForJudge(
        selectedJudge.id,
      );
      if (!connectionId) {
        this.logger.error(
          `No connection ID found for judge ${selectedJudge.name}`,
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
          `Submission ${queueEntry.submission.id} sent to judge ${selectedJudge.name}`,
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
      `Test case ${data.caseNumber} for submission ${data.submissionId}: ${data.status}`,
    );

    // Map DMOJ status to our verdict enum
    const verdict = this.mapDMOJStatusToVerdict(data.status);

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

    // Calculate final result from test cases
    const testCases = await this.prisma.submissionTestCase.findMany({
      where: { submissionId: data.submissionId },
    });

    // Determine final verdict and calculate stats
    let finalVerdict: SubmissionVerdict = SubmissionVerdict.AC;
    let totalPoints = 0;
    let maxPoints = 0;
    let maxTime = 0;
    let maxMemory = 0;

    for (const testCase of testCases) {
      totalPoints += testCase.points || 0;
      maxPoints += testCase.maxPoints || 0;
      maxTime = Math.max(maxTime, testCase.time || 0);
      maxMemory = Math.max(maxMemory, testCase.memory || 0);

      // If any test case failed, update final verdict
      if (
        testCase.verdict !== SubmissionVerdict.AC &&
        finalVerdict === SubmissionVerdict.AC
      ) {
        finalVerdict = testCase.verdict;
      }
    }

    // Complete submission
    await this.queueService.completeSubmission(
      data.submissionId,
      finalVerdict,
      {
        points: totalPoints,
        maxMemory: maxMemory > 0 ? maxMemory : undefined,
        maxTime: maxTime > 0 ? maxTime : undefined,
      },
    );

    // Emit event for WebSocket clients
    this.eventEmitter.emit('submission.update', {
      submissionId: data.submissionId,
      verdict: finalVerdict,
      points: totalPoints,
      maxPoints,
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
   */
  private mapDMOJStatusToVerdict(status: string): SubmissionVerdict {
    const statusMap: Record<string, SubmissionVerdict> = {
      AC: SubmissionVerdict.AC,
      WA: SubmissionVerdict.WA,
      TLE: SubmissionVerdict.TLE,
      MLE: SubmissionVerdict.MLE,
      OLE: SubmissionVerdict.OLE,
      IR: SubmissionVerdict.IR,
      RTE: SubmissionVerdict.RTE,
      CE: SubmissionVerdict.CE,
      IE: SubmissionVerdict.ISE,
    };

    return statusMap[status] || SubmissionVerdict.ISE;
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
      isConnected: this.dmojBridge.isJudgeConnected(judge.id),
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
