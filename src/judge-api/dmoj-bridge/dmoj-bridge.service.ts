import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import * as net from 'net';
import * as zlib from 'zlib';
import { PrismaService } from '@/prisma/prisma.service';

interface DMOJPacket {
  name: string;
  data: any;
}

interface DMOJSubmissionData {
  id: number;
  problem: string;
  language: string;
  source: string;
  time_limit: number;
  memory_limit: number;
}

@Injectable()
export class DMOJBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DMOJBridgeService.name);
  private judgeConnections = new Map<string, net.Socket>();
  private authenticatedJudges = new Set<string>();
  private tcpServer: net.Server;
  private readonly port: number;

  constructor(
    private eventEmitter: EventEmitter2,
    private jwtService: JwtService,
    private prismaService: PrismaService,
  ) {
    // Use JUDGE_PORT environment variable, default to 9999
    this.port = parseInt(process.env.JUDGE_PORT || '9999', 10);
  }

  async onModuleInit() {
    await this.startTcpServer();
  }

  async onModuleDestroy() {
    await this.stopTcpServer();
  }

  /**
   * Start TCP server to listen for incoming judge connections
   */
  private async startTcpServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.tcpServer = net.createServer((socket) => {
        this.handleJudgeConnection(socket);
      });

      this.tcpServer.listen(this.port, '0.0.0.0', () => {
        this.logger.log(`DMOJ Judge server listening on port ${this.port}`);
        resolve();
      });

      this.tcpServer.on('error', (error) => {
        this.logger.error(`TCP Server error:`, error);
        reject(error);
      });
    });
  }

  /**
   * Stop TCP server
   */
  private async stopTcpServer(): Promise<void> {
    return new Promise((resolve) => {
      if (this.tcpServer) {
        this.tcpServer.close(() => {
          this.logger.log('DMOJ Judge server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle incoming judge connection
   */
  private handleJudgeConnection(socket: net.Socket): void {
    const judgeId = `judge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;

    this.logger.log(
      `New judge connection from ${remoteAddress} (ID: ${judgeId})`,
    );

    this.judgeConnections.set(judgeId, socket);
    this.setupSocketHandlers(judgeId, socket);

    socket.on('close', () => {
      this.logger.log(`Judge ${judgeId} disconnected`);
      this.judgeConnections.delete(judgeId);
      this.authenticatedJudges.delete(judgeId);
    });

    socket.on('error', (error) => {
      this.logger.error(`Judge ${judgeId} connection error:`, error);
      this.judgeConnections.delete(judgeId);
      this.authenticatedJudges.delete(judgeId);
    });
  }

  /**
   * Setup socket event handlers for a judge connection
   */
  private setupSocketHandlers(judgeId: string, socket: net.Socket): void {
    let buffer = Buffer.alloc(0);

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);

      while (buffer.length >= 4) {
        const size = buffer.readUInt32BE(0);

        if (buffer.length >= size + 4) {
          const packetData = buffer.slice(4, size + 4);
          buffer = buffer.slice(size + 4);

          try {
            const decompressed = zlib.inflateSync(packetData);
            const packet: DMOJPacket = JSON.parse(decompressed.toString());
            this.handlePacket(judgeId, packet);
          } catch (error) {
            this.logger.error(
              `Failed to parse packet from judge ${judgeId}:`,
              error,
            );
          }
        } else {
          break;
        }
      }
    });
  }

  /**
   * Handle incoming packets from judges
   */
  private handlePacket(judgeId: string, packet: DMOJPacket): void {
    this.logger.debug(`Received packet from judge ${judgeId}:`, packet.name);

    switch (packet.name) {
      case 'handshake':
        void this.handleHandshake(judgeId, packet.data);
        break;
      case 'supported-problems':
        this.handleSupportedProblems(judgeId, packet.data);
        break;
      case 'compile-error':
        this.handleCompileError(judgeId, packet.data);
        break;
      case 'compile-message':
        this.handleCompileMessage(judgeId, packet.data);
        break;
      case 'begin-grading':
        this.handleBeginGrading(judgeId, packet.data);
        break;
      case 'grading-end':
        this.handleGradingEnd(judgeId, packet.data);
        break;
      case 'batch-begin':
        this.handleBatchBegin(judgeId, packet.data);
        break;
      case 'batch-end':
        this.handleBatchEnd(judgeId, packet.data);
        break;
      case 'test-case-status':
        this.handleTestCaseStatus(judgeId, packet.data);
        break;
      case 'submission-terminated':
        this.handleSubmissionTerminated(judgeId, packet.data);
        break;
      case 'submission-aborted':
        this.handleSubmissionAborted(judgeId, packet.data);
        break;
      default:
        this.logger.warn(`Unknown packet type: ${packet.name}`);
    }
  }

  /**
   * Send a packet to a judge
   */
  private sendPacket(judgeId: string, packetName: string, data: any): boolean {
    const socket = this.judgeConnections.get(judgeId);
    if (!socket) {
      this.logger.error(`No connection to judge ${judgeId}`);
      return false;
    }

    try {
      const packet = { name: packetName, data };
      const jsonData = JSON.stringify(packet);
      const compressed = zlib.deflateSync(Buffer.from(jsonData));
      const size = Buffer.allocUnsafe(4);
      size.writeUInt32BE(compressed.length, 0);

      socket.write(Buffer.concat([size, compressed]));
      return true;
    } catch (error) {
      this.logger.error(`Failed to send packet to judge ${judgeId}:`, error);
      return false;
    }
  }

  /**
   * Submit a submission to a judge for grading
   */
  submitToJudge(judgeId: string, submission: DMOJSubmissionData): boolean {
    if (!this.authenticatedJudges.has(judgeId)) {
      this.logger.error(`Judge ${judgeId} not authenticated`);
      return false;
    }

    return this.sendPacket(judgeId, 'submission-request', {
      submission_id: submission.id,
      problem_id: submission.problem,
      language: submission.language,
      source: submission.source,
      time_limit: submission.time_limit,
      memory_limit: submission.memory_limit,
    });
  }

  /**
   * Abort a submission
   */
  abortSubmission(judgeId: string, submissionId: number): boolean {
    return this.sendPacket(judgeId, 'terminate-submission', {
      submission_id: submissionId,
    });
  }

  // Packet handlers
  private async handleHandshake(judgeId: string, data: any): Promise<void> {
    try {
      const judgeName = data.id;
      const judgeKey = data.key;

      if (!judgeName || !judgeKey) {
        this.logger.error(`Judge ${judgeId} sent invalid handshake data`);
        this.sendHandshakeFailure(judgeId, 'Missing judge name or key');
        return;
      }

      // Verify JWT token
      let payload;
      try {
        payload = await this.jwtService.verifyAsync(judgeKey, {
          secret: process.env.JWT_JUDGE_TOKEN,
        });
      } catch (error) {
        this.logger.error(`Judge ${judgeId} JWT verification failed:`, error);
        this.sendHandshakeFailure(judgeId, 'Invalid authentication token');
        return;
      }

      // Find judge in database
      const judge = await this.prismaService.judge.findFirst({
        where: {
          name: judgeName,
          token: {
            id: payload.id,
            createdAt: payload.createdAt,
          },
        },
      });

      if (!judge) {
        this.logger.error(
          `Judge ${judgeName} not found in database or token mismatch`,
        );
        this.sendHandshakeFailure(judgeId, 'Judge not found or invalid token');
        return;
      }

      if (judge.status !== 'ACTIVE') {
        this.logger.error(
          `Judge ${judgeName} is not active (status: ${judge.status})`,
        );
        this.sendHandshakeFailure(judgeId, 'Judge is not active');
        return;
      }

      // Authentication successful
      this.logger.log(`Judge ${judgeName} authenticated successfully`);
      this.authenticatedJudges.add(judgeId);

      // Update last active timestamp
      await this.prismaService.judge.update({
        where: { id: judge.id },
        data: { lastActive: new Date() },
      });

      // Send handshake success response
      this.sendHandshakeSuccess(judgeId);

      // Emit event for successful authentication
      this.eventEmitter.emit('judge.authenticated', {
        judgeId,
        judgeName,
        data,
      });
    } catch (error) {
      this.logger.error(`Handshake error for judge ${judgeId}:`, error);
      this.sendHandshakeFailure(judgeId, 'Internal server error');
    }
  }

  private sendHandshakeSuccess(judgeId: string): void {
    this.sendPacket(judgeId, 'handshake-success', {});
  }

  private sendHandshakeFailure(judgeId: string, reason: string): void {
    this.sendPacket(judgeId, 'handshake-failure', { reason });
    // Disconnect the judge after sending failure
    setTimeout(() => {
      const socket = this.judgeConnections.get(judgeId);
      if (socket) {
        socket.destroy();
        this.judgeConnections.delete(judgeId);
        this.authenticatedJudges.delete(judgeId);
      }
    }, 100);
  }

  private handleSupportedProblems(judgeId: string, data: any): void {
    this.logger.debug(`Judge ${judgeId} supports problems:`, data);
    this.eventEmitter.emit('judge.supported-problems', {
      judgeId,
      problems: data,
    });
  }

  private handleCompileError(judgeId: string, data: any): void {
    this.logger.debug(`Compile error from judge ${judgeId}:`, data);
    this.eventEmitter.emit('submission.compile-error', {
      judgeId,
      submissionId: data.submission_id,
      error: data.log,
    });
  }

  private handleCompileMessage(judgeId: string, data: any): void {
    this.logger.debug(`Compile message from judge ${judgeId}:`, data);
    this.eventEmitter.emit('submission.compile-message', {
      judgeId,
      submissionId: data.submission_id,
      message: data.log,
    });
  }

  private handleBeginGrading(judgeId: string, data: any): void {
    this.logger.debug(`Begin grading from judge ${judgeId}:`, data);
    this.eventEmitter.emit('submission.begin-grading', {
      judgeId,
      submissionId: data.submission_id,
      isPretest: data.is_pretest,
    });
  }

  private handleGradingEnd(judgeId: string, data: any): void {
    this.logger.debug(`Grading end from judge ${judgeId}:`, data);
    this.eventEmitter.emit('submission.grading-end', {
      judgeId,
      submissionId: data.submission_id,
    });
  }

  private handleBatchBegin(judgeId: string, data: any): void {
    this.logger.debug(`Batch begin from judge ${judgeId}:`, data);
    this.eventEmitter.emit('submission.batch-begin', {
      judgeId,
      submissionId: data.submission_id,
      batchNumber: data.batch_no,
    });
  }

  private handleBatchEnd(judgeId: string, data: any): void {
    this.logger.debug(`Batch end from judge ${judgeId}:`, data);
    this.eventEmitter.emit('submission.batch-end', {
      judgeId,
      submissionId: data.submission_id,
      batchNumber: data.batch_no,
    });
  }

  private handleTestCaseStatus(judgeId: string, data: any): void {
    this.logger.debug(`Test case status from judge ${judgeId}:`, data);
    this.eventEmitter.emit('submission.test-case-status', {
      judgeId,
      submissionId: data.submission_id,
      caseNumber: data.case,
      batchNumber: data.batch,
      status: data.status,
      time: data.time,
      memory: data.memory,
      points: data.points,
      totalPoints: data.total_points,
      feedback: data.feedback,
      output: data.output,
      expected: data.expected,
    });
  }

  private handleSubmissionTerminated(judgeId: string, data: any): void {
    this.logger.debug(`Submission terminated from judge ${judgeId}:`, data);
    this.eventEmitter.emit('submission.terminated', {
      judgeId,
      submissionId: data.submission_id,
    });
  }

  private handleSubmissionAborted(judgeId: string, data: any): void {
    this.logger.debug(`Submission aborted from judge ${judgeId}:`, data);
    this.eventEmitter.emit('submission.aborted', {
      judgeId,
      submissionId: data.submission_id,
    });
  }

  /**
   * Check if judge is connected and authenticated
   */
  isJudgeConnected(judgeId: string): boolean {
    return (
      this.judgeConnections.has(judgeId) &&
      this.authenticatedJudges.has(judgeId)
    );
  }

  /**
   * Get all connected judges
   */
  getConnectedJudges(): string[] {
    return Array.from(this.authenticatedJudges);
  }

  /**
   * Disconnect from a judge
   */
  disconnectJudge(judgeId: string): void {
    const socket = this.judgeConnections.get(judgeId);
    if (socket) {
      socket.destroy();
      this.judgeConnections.delete(judgeId);
      this.authenticatedJudges.delete(judgeId);
    }
  }

  /**
   * Disconnect from all judges
   */
  disconnectAll(): void {
    for (const [, socket] of this.judgeConnections) {
      socket.destroy();
    }
    this.judgeConnections.clear();
    this.authenticatedJudges.clear();
  }
}
