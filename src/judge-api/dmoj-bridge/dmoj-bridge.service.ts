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

interface JudgeCapabilities {
  problems: string[];
  executors: { [key: string]: any };
}

@Injectable()
export class DMOJBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DMOJBridgeService.name);
  private judgeConnections = new Map<string, net.Socket>();
  private judgeCapabilities = new Map<string, JudgeCapabilities>();
  private connectedJudgeNames = new Set<string>(); // Judge names that are connected
  private connectionIdToJudgeName = new Map<string, string>(); // connection ID -> judge name
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

      // Get judge name and remove from connected set
      const judgeName = this.connectionIdToJudgeName.get(judgeId);
      if (judgeName) {
        this.connectedJudgeNames.delete(judgeName);
        this.connectionIdToJudgeName.delete(judgeId);
        this.logger.log(
          `Removed ${judgeName} from connected judges. Total connected: ${this.connectedJudgeNames.size}`,
        );
      }

      this.judgeConnections.delete(judgeId);
      this.judgeCapabilities.delete(judgeId);
    });

    socket.on('error', (error) => {
      this.logger.error(`Judge ${judgeId} connection error:`, error);

      // Get judge name and remove from connected set
      const judgeName = this.connectionIdToJudgeName.get(judgeId);
      if (judgeName) {
        this.connectedJudgeNames.delete(judgeName);
        this.connectionIdToJudgeName.delete(judgeId);
      }

      this.judgeConnections.delete(judgeId);
      this.judgeCapabilities.delete(judgeId);
    });
  }

  /**
   * Setup socket event handlers for a judge connection
   */
  private setupSocketHandlers(judgeId: string, socket: net.Socket): void {
    let buffer = Buffer.alloc(0);

    this.logger.log(`🔌 Setting up socket handlers for judge ${judgeId}`);

    socket.on('data', (data) => {
      this.logger.debug(
        `📥 Received ${data.length} bytes from judge ${judgeId}`,
      );
      buffer = Buffer.concat([buffer, data]);

      while (buffer.length >= 4) {
        const size = buffer.readUInt32BE(0);
        this.logger.debug(
          `📊 Packet size: ${size}, buffer length: ${buffer.length}`,
        );

        if (buffer.length >= size + 4) {
          const packetData = buffer.slice(4, size + 4);
          buffer = buffer.slice(size + 4);

          try {
            const decompressed = zlib.inflateSync(packetData);
            this.logger.debug(`📦 Decompressed packet successfully`);
            this.logger.debug(
              `🔍 Raw decompressed data:`,
              decompressed.toString(),
            );

            const packet: DMOJPacket = JSON.parse(decompressed.toString());
            this.logger.debug(
              `🎯 Parsed packet:`,
              JSON.stringify(packet, null, 2),
            );

            this.handlePacket(judgeId, packet);
          } catch (error) {
            this.logger.error(
              `❌ Failed to parse packet from judge ${judgeId}:`,
              error,
            );
            this.logger.error(
              `Raw packet data (first 100 bytes):`,
              packetData.slice(0, 100),
            );
          }
        } else {
          this.logger.debug(`⏳ Waiting for more data...`);
          break;
        }
      }
    });
  }

  /**
   * Handle incoming packets from judges
   */
  private handlePacket(judgeId: string, packet: DMOJPacket): void {
    this.logger.debug(
      `📦 Received packet from judge ${judgeId}: ${packet.name}`,
    );
    this.logger.debug(`Full packet:`, JSON.stringify(packet, null, 2));

    switch (packet.name) {
      case 'handshake':
        void this.handleHandshake(judgeId, packet);
        break;
      case 'supported-problems':
        this.handleSupportedProblems(judgeId, packet);
        break;
      case 'compile-error':
        this.handleCompileError(judgeId, packet);
        break;
      case 'compile-message':
        this.handleCompileMessage(judgeId, packet);
        break;
      case 'begin-grading':
      case 'grading-begin':
        this.handleBeginGrading(judgeId, packet);
        break;
      case 'grading-end':
        this.handleGradingEnd(judgeId, packet);
        break;
      case 'batch-begin':
        this.handleBatchBegin(judgeId, packet);
        break;
      case 'batch-end':
        this.handleBatchEnd(judgeId, packet);
        break;
      case 'test-case-status':
        this.handleTestCaseStatus(judgeId, packet);
        break;
      case 'submission-terminated':
        this.handleSubmissionTerminated(judgeId, packet);
        break;
      case 'submission-aborted':
        this.handleSubmissionAborted(judgeId, packet);
        break;
      case 'submission-acknowledged':
        this.handleSubmissionAcknowledged(judgeId, packet);
        break;
      default:
        this.logger.warn(`❓ Unknown packet type: ${packet.name}`);
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
    const judgeName = this.connectionIdToJudgeName.get(judgeId);
    if (!judgeName || !this.connectedJudgeNames.has(judgeName)) {
      this.logger.error(`Judge ${judgeId} not connected or authenticated`);
      return false;
    }

    // For submission-request, DMOJ expects the fields at root level, not in data
    const socket = this.judgeConnections.get(judgeId);
    if (!socket) {
      this.logger.error(`No connection to judge ${judgeId}`);
      return false;
    }

    try {
      const packet = {
        name: 'submission-request',
        'submission-id': submission.id,
        'problem-id': submission.problem,
        language: submission.language,
        source: submission.source,
        'time-limit': submission.time_limit,
        'memory-limit': submission.memory_limit,
        'short-circuit': false,
        meta: {},
      };

      const jsonData = JSON.stringify(packet);
      const compressed = zlib.deflateSync(Buffer.from(jsonData));
      const size = Buffer.allocUnsafe(4);
      size.writeUInt32BE(compressed.length, 0);

      socket.write(Buffer.concat([size, compressed]));
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send submission to judge ${judgeId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Abort a submission
   */
  abortSubmission(judgeId: string, submissionId: number): boolean {
    const socket = this.judgeConnections.get(judgeId);
    if (!socket) {
      this.logger.error(`No connection to judge ${judgeId}`);
      return false;
    }

    try {
      const packet = {
        name: 'terminate-submission',
        'submission-id': submissionId,
      };

      const jsonData = JSON.stringify(packet);
      const compressed = zlib.deflateSync(Buffer.from(jsonData));
      const size = Buffer.allocUnsafe(4);
      size.writeUInt32BE(compressed.length, 0);

      socket.write(Buffer.concat([size, compressed]));
      return true;
    } catch (error) {
      this.logger.error(`Failed to abort submission ${submissionId}:`, error);
      return false;
    }
  }

  // Packet handlers
  private async handleHandshake(judgeId: string, data: any): Promise<void> {
    this.logger.log(`=== HANDSHAKE DEBUG START for ${judgeId} ===`);
    this.logger.log(`Handshake data received:`, JSON.stringify(data, null, 2));

    try {
      const judgeName = data.id;
      const judgeKey = data.key;

      this.logger.log(`Judge name: ${judgeName}`);
      this.logger.log(
        `Judge key (first 50 chars): ${judgeKey?.substring(0, 50)}...`,
      );

      if (!judgeName || !judgeKey) {
        this.logger.error(
          `Missing judge name or key - name: ${judgeName}, key: ${!!judgeKey}`,
        );
        this.sendHandshakeFailure(judgeId, 'Missing judge name or key');
        return;
      }

      // Verify JWT token
      this.logger.log(
        `Attempting JWT verification with secret: ${process.env.JWT_JUDGE_TOKEN?.substring(0, 10)}...`,
      );
      let payload;
      try {
        payload = await this.jwtService.verifyAsync(judgeKey, {
          secret: process.env.JWT_JUDGE_TOKEN,
        });
        this.logger.log(
          `JWT verification successful, payload:`,
          JSON.stringify(payload, null, 2),
        );
      } catch (error) {
        this.logger.error(`JWT verification failed:`, error.message);
        this.logger.error(`JWT error details:`, error);
        this.sendHandshakeFailure(judgeId, 'Invalid authentication token');
        return;
      }

      // Find judge in database
      this.logger.log(
        `Looking up judge in database - name: ${judgeName}, token ID: ${payload.id}`,
      );
      const judge = await this.prismaService.judge.findFirst({
        where: {
          name: judgeName,
          token: {
            id: payload.id,
            createdAt: payload.createdAt,
          },
        },
        include: {
          token: true,
        },
      });

      if (!judge) {
        this.logger.error(`Judge not found in database or token mismatch`);
        this.logger.error(
          `Search criteria: name=${judgeName}, tokenId=${payload.id}, createdAt=${payload.createdAt}`,
        );

        // Debug: Show what judges exist
        const allJudges = await this.prismaService.judge.findMany({
          include: { token: true },
        });
        this.logger.error(
          `Available judges:`,
          JSON.stringify(allJudges, null, 2),
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
      this.logger.log(`🎉 Judge ${judgeName} authenticated successfully!`);

      // Add judge name to connected judges set
      this.connectedJudgeNames.add(judgeName);
      this.connectionIdToJudgeName.set(judgeId, judgeName);
      this.logger.log(
        `Added ${judgeName} to connected judges. Total connected: ${this.connectedJudgeNames.size}`,
      );

      // Store judge capabilities
      const problems = (data.problems || []).map((p: any) => p[0]); // Extract problem names
      const executors = data.executors || {};

      this.judgeCapabilities.set(judgeId, {
        problems,
        executors,
      });

      this.logger.log(
        `Judge ${judgeName} capabilities: ${problems.length} problems, ${Object.keys(executors).length} executors`,
      );

      // Update last active timestamp
      await this.prismaService.judge.update({
        where: { id: judge.id },
        data: { lastActive: new Date() },
      });

      // Send handshake success response
      this.logger.log(`Sending handshake success to ${judgeId}`);
      this.sendHandshakeSuccess(judgeId);

      // Emit event for successful authentication
      this.eventEmitter.emit('judge.authenticated', {
        connectionId: judgeId,
        judgeId: judge.id,
        judgeName,
        judge,
        data,
      });

      this.logger.log(`=== HANDSHAKE DEBUG END for ${judgeId} ===`);
    } catch (error) {
      this.logger.error(`Handshake error for judge ${judgeId}:`, error);
      this.logger.error(`Error stack:`, error.stack);
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

        // Remove from connected judges if it was added
        const judgeName = this.connectionIdToJudgeName.get(judgeId);
        if (judgeName) {
          this.connectedJudgeNames.delete(judgeName);
          this.connectionIdToJudgeName.delete(judgeId);
        }
      }
    }, 100);
  }

  private handleSupportedProblems(judgeId: string, packet: any): void {
    this.logger.debug(`Judge ${judgeId} supports problems:`, packet);
    this.eventEmitter.emit('judge.supported-problems', {
      judgeId,
      problems: packet.problems || packet, // Support both flat and nested structure
    });
  }

  private handleCompileError(judgeId: string, data: any): void {
    this.logger.debug(`Compile error from judge ${judgeId}:`, data);
    this.eventEmitter.emit('submission.compile-error', {
      judgeId,
      submissionId: data['submission-id'],
      error: data.log,
    });
  }

  private handleCompileMessage(judgeId: string, data: any): void {
    this.logger.debug(`Compile message from judge ${judgeId}:`, data);
    this.eventEmitter.emit('submission.compile-message', {
      judgeId,
      submissionId: data['submission-id'],
      message: data.log,
    });
  }

  private handleBeginGrading(judgeId: string, data: any): void {
    this.logger.debug(`Begin grading from judge ${judgeId}:`, data);
    this.eventEmitter.emit('submission.begin-grading', {
      judgeId,
      submissionId: data['submission-id'],
      isPretest: data.pretested || data['is-pretest'],
    });
  }

  private handleGradingEnd(judgeId: string, data: any): void {
    this.logger.debug(`Grading end from judge ${judgeId}:`, data);
    this.eventEmitter.emit('submission.grading-end', {
      judgeId,
      submissionId: data['submission-id'],
    });
  }

  private handleBatchBegin(judgeId: string, data: any): void {
    this.logger.debug(`Batch begin from judge ${judgeId}:`, data);
    this.eventEmitter.emit('submission.batch-begin', {
      judgeId,
      submissionId: data['submission-id'],
      batchNumber: data['batch-no'],
    });
  }

  private handleBatchEnd(judgeId: string, data: any): void {
    this.logger.debug(`Batch end from judge ${judgeId}:`, data);
    this.eventEmitter.emit('submission.batch-end', {
      judgeId,
      submissionId: data['submission-id'],
      batchNumber: data['batch-no'],
    });
  }

  private handleTestCaseStatus(judgeId: string, data: any): void {
    this.logger.debug(`Test case status from judge ${judgeId}:`, data);

    // DMOJ sends test-case-status with a cases array containing multiple test cases
    if (data.cases && Array.isArray(data.cases)) {
      data.cases.forEach((testCase: any) => {
        this.eventEmitter.emit('submission.test-case-status', {
          judgeId,
          submissionId: data['submission-id'],
          caseNumber: testCase.position,
          batchNumber: testCase.batch,
          status: testCase.status,
          time: testCase.time,
          memory: testCase.memory,
          points: testCase.points,
          totalPoints: testCase['total-points'],
          feedback: testCase.feedback || testCase['extended-feedback'] || '',
          output: testCase.output,
          input: testCase.input || '',
          expected: testCase['expected-output'] || testCase.expected || '',
        });
      });
    } else {
      // Fallback for individual test case format (if it exists)
      this.eventEmitter.emit('submission.test-case-status', {
        judgeId,
        submissionId: data['submission-id'],
        caseNumber: data.case || data.position,
        batchNumber: data.batch,
        status: data.status,
        time: data.time,
        memory: data.memory,
        points: data.points,
        totalPoints: data['total-points'],
        feedback: data.feedback || data['extended-feedback'] || '',
        output: data.output,
        input: data.input || '',
        expected: data['expected-output'] || data.expected || '',
      });
    }
  }

  private handleSubmissionTerminated(judgeId: string, data: any): void {
    this.logger.debug(`Submission terminated from judge ${judgeId}:`, data);
    this.eventEmitter.emit('submission.terminated', {
      judgeId,
      submissionId: data['submission-id'],
    });
  }

  private handleSubmissionAborted(judgeId: string, data: any): void {
    this.logger.debug(`Submission aborted from judge ${judgeId}:`, data);
    this.eventEmitter.emit('submission.aborted', {
      judgeId,
      submissionId: data['submission-id'],
    });
  }

  private handleSubmissionAcknowledged(judgeId: string, packet: any): void {
    const submissionId = packet['submission-id'];
    this.logger.log(
      `✅ Submission ${submissionId} acknowledged by judge ${judgeId}`,
    );
    this.eventEmitter.emit('submission.acknowledged', {
      judgeId,
      submissionId,
    });
  }

  /**
   * Check if a judge name is connected
   */
  isJudgeConnected(judgeName: string): boolean {
    return this.connectedJudgeNames.has(judgeName);
  }

  /**
   * Get connection ID for a judge name
   */
  getConnectionIdForJudgeName(judgeName: string): string | undefined {
    for (const [connectionId, name] of this.connectionIdToJudgeName.entries()) {
      if (name === judgeName) {
        return connectionId;
      }
    }
    return undefined;
  }

  /**
   * Get all connected judge names
   */
  getConnectedJudges(): string[] {
    return Array.from(this.connectedJudgeNames);
  }

  /**
   * Get judge capabilities (problems and executors)
   */
  getJudgeCapabilities(
    judgeId?: string,
  ): JudgeCapabilities | Map<string, JudgeCapabilities> {
    if (judgeId) {
      return (
        this.judgeCapabilities.get(judgeId) || { problems: [], executors: {} }
      );
    }
    return this.judgeCapabilities;
  }

  /**
   * Get all available problems across all judges
   */
  getAvailableProblems(): string[] {
    const allProblems = new Set<string>();
    for (const capabilities of this.judgeCapabilities.values()) {
      capabilities.problems.forEach((problem) => allProblems.add(problem));
    }
    return Array.from(allProblems);
  }

  /**
   * Get all available executors across all judges
   */
  getAvailableExecutors(): string[] {
    const allExecutors = new Set<string>();
    for (const capabilities of this.judgeCapabilities.values()) {
      Object.keys(capabilities.executors).forEach((executor) =>
        allExecutors.add(executor),
      );
    }
    return Array.from(allExecutors);
  }

  /**
   * Check if a problem is available on any judge
   */
  isProblemAvailable(problemSlug: string): boolean {
    for (const capabilities of this.judgeCapabilities.values()) {
      if (capabilities.problems.includes(problemSlug)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a language/executor is available on any judge
   */
  isExecutorAvailable(executor: string): boolean {
    for (const capabilities of this.judgeCapabilities.values()) {
      if (executor in capabilities.executors) {
        return true;
      }
    }
    return false;
  }

  /**
   * Disconnect from a judge
   */
  disconnectJudge(judgeId: string): void {
    const socket = this.judgeConnections.get(judgeId);
    if (socket) {
      socket.destroy();
      this.judgeConnections.delete(judgeId);
      this.judgeCapabilities.delete(judgeId);

      // Remove from connected judges
      const judgeName = this.connectionIdToJudgeName.get(judgeId);
      if (judgeName) {
        this.connectedJudgeNames.delete(judgeName);
        this.connectionIdToJudgeName.delete(judgeId);
      }
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
    this.judgeCapabilities.clear();
    this.connectedJudgeNames.clear();
    this.connectionIdToJudgeName.clear();
  }
}
