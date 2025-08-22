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
  private judgeNameToIdInDB = new Map<string, string>(); // judge name -> judge ID in database
  private judgePingIntervals = new Map<string, NodeJS.Timeout>(); // Track ping intervals for each judge
  private tcpServer: net.Server;
  private readonly port: number;
  private readonly listeningAddress: string;

  constructor(
    private eventEmitter: EventEmitter2,
    private jwtService: JwtService,
    private prismaService: PrismaService,
  ) {
    // Use JUDGE_PORT environment variable, default to 9999
    this.port = parseInt(process.env.JUDGE_PORT || '9999', 10);
    this.listeningAddress = process.env.BRIDGE_LISTENING_ADDRESS || '0.0.0.0';
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

      this.tcpServer.listen(this.port, this.listeningAddress, () => {
        this.logger.log(
          `DMOJ Judge server is listening on ${this.listeningAddress}:${this.port}`,
        );
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
    const judgeConnectionId = `judge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;

    this.logger.log(
      `New judge connection from ${remoteAddress} (ID: ${judgeConnectionId})`,
    );

    this.judgeConnections.set(judgeConnectionId, socket);
    this.setupSocketHandlers(judgeConnectionId, socket);

    socket.on('close', () => {
      this.logger.log(`Judge ${judgeConnectionId} disconnected`);

      // Get judge name and remove from connected set
      const judgeName = this.connectionIdToJudgeName.get(judgeConnectionId);
      if (judgeName) {
        this.connectedJudgeNames.delete(judgeName);
        this.connectionIdToJudgeName.delete(judgeConnectionId);
        this.logger.log(
          `Removed ${judgeName} from connected judges. Total connected: ${this.connectedJudgeNames.size}`,
        );

        // Stop ping interval for this judge
        const pingInterval = this.judgePingIntervals.get(judgeConnectionId);
        if (pingInterval) {
          clearInterval(pingInterval);
          this.judgePingIntervals.delete(judgeConnectionId);
          this.logger.debug(`Stopped ping interval for judge ${judgeName}`);
        }
      }

      this.judgeConnections.delete(judgeConnectionId);
      this.judgeCapabilities.delete(judgeConnectionId);
    });

    socket.on('error', (error) => {
      this.logger.error(`Judge ${judgeConnectionId} connection error:`, error);

      // Get judge name and remove from connected set
      const judgeName = this.connectionIdToJudgeName.get(judgeConnectionId);
      if (judgeName) {
        this.connectedJudgeNames.delete(judgeName);
        this.connectionIdToJudgeName.delete(judgeConnectionId);

        // Stop ping interval for this judge
        const pingInterval = this.judgePingIntervals.get(judgeConnectionId);
        if (pingInterval) {
          clearInterval(pingInterval);
          this.judgePingIntervals.delete(judgeConnectionId);
        }
      }

      this.judgeConnections.delete(judgeConnectionId);
      this.judgeCapabilities.delete(judgeConnectionId);
    });

    socket.on('timeout', () => {
      // Get judge name for logging
      const judgeName = this.connectionIdToJudgeName.get(judgeConnectionId);
      if (judgeName) {
        this.logger.warn(
          `Judge seems dead: ${judgeName}: (timeout but not disconnecting)`,
        );
      } else {
        this.logger.warn(
          `Judge ${judgeConnectionId} connection timeout (but not disconnecting)`,
        );
      }
      // DMOJ doesn't disconnect on timeout - just logs a warning
      // The timeout gets reset when new packets arrive (including pings)
    });
  }

  /**
   * Setup socket event handlers for a judge connection
   */
  private setupSocketHandlers(
    judgeConnectionId: string,
    socket: net.Socket,
  ): void {
    let buffer = Buffer.alloc(0);

    this.logger.log(
      `🔌 Setting up socket handlers for judge ${judgeConnectionId}`,
    );

    socket.on('data', (data) => {
      this.logger.debug(
        `📥 Received ${data.length} bytes from judge ${judgeConnectionId}`,
      );
      buffer = Buffer.concat([buffer, data]);

      while (buffer.length >= 4) {
        const size = buffer.readUInt32BE(0);
        this.logger.debug(
          `📊 Packet size: ${size}, buffer length: ${buffer.length}`,
        );

        if (buffer.length >= size + 4) {
          const packetData = buffer.subarray(4, size + 4);
          buffer = buffer.subarray(size + 4);

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

            this.handlePacket(judgeConnectionId, packet);
          } catch (error) {
            this.logger.error(
              `❌ Failed to parse packet from judge ${judgeConnectionId}:`,
              error,
            );
            this.logger.error(
              `Raw packet data (first 100 bytes):`,
              packetData.subarray(0, 100),
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
  private handlePacket(judgeConnectionId: string, packet: DMOJPacket): void {
    this.logger.debug(
      `📦 Received packet from judge ${judgeConnectionId}: ${packet.name}`,
    );
    this.logger.debug(`Full packet:`, JSON.stringify(packet, null, 2));

    // Reset socket timeout on any packet received (like DMOJ does)
    const socket = this.judgeConnections.get(judgeConnectionId);
    if (socket) {
      socket.setTimeout(60000); // Reset timeout to 60 seconds
    }

    switch (packet.name) {
      case 'handshake':
        void this.handleHandshake(judgeConnectionId, packet);
        break;
      case 'supported-problems':
        this.handleSupportedProblems(judgeConnectionId, packet);
        break;
      case 'compile-error':
        this.handleCompileError(judgeConnectionId, packet);
        break;
      case 'compile-message':
        this.handleCompileMessage(judgeConnectionId, packet);
        break;
      case 'begin-grading':
      case 'grading-begin':
        this.handleBeginGrading(judgeConnectionId, packet);
        break;
      case 'grading-end':
        this.handleGradingEnd(judgeConnectionId, packet);
        break;
      case 'batch-begin':
        this.handleBatchBegin(judgeConnectionId, packet);
        break;
      case 'batch-end':
        this.handleBatchEnd(judgeConnectionId, packet);
        break;
      case 'test-case-status':
        this.handleTestCaseStatus(judgeConnectionId, packet);
        break;
      case 'submission-terminated':
        this.handleSubmissionTerminated(judgeConnectionId, packet);
        break;
      case 'submission-aborted':
        this.handleSubmissionAborted(judgeConnectionId, packet);
        break;
      case 'submission-acknowledged':
        this.handleSubmissionAcknowledged(judgeConnectionId, packet);
        break;
      case 'ping-response':
        this.handlePingResponse(judgeConnectionId, packet);
        break;
      default:
        this.logger.warn(`❓ Unknown packet type: ${packet.name}`);
    }
  }

  /**
   * Send a packet to a judge
   */
  private sendPacket(
    judgeConnectionId: string,
    packetName: string,
    data: any,
  ): boolean {
    const socket = this.judgeConnections.get(judgeConnectionId);
    if (!socket) {
      this.logger.error(`No connection to judge ${judgeConnectionId}`);
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
      this.logger.error(
        `Failed to send packet to judge ${judgeConnectionId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Submit a submission to a judge for grading
   */
  submitToJudge(
    judgeConnectionId: string,
    submission: DMOJSubmissionData,
  ): boolean {
    const judgeName = this.connectionIdToJudgeName.get(judgeConnectionId);
    if (!judgeName || !this.connectedJudgeNames.has(judgeName)) {
      this.logger.error(
        `Judge ${judgeConnectionId} not connected or authenticated`,
      );
      return false;
    }

    // For submission-request, DMOJ expects the fields at root level, not in data
    const socket = this.judgeConnections.get(judgeConnectionId);
    if (!socket) {
      this.logger.error(`No connection to judge ${judgeConnectionId}`);
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
        `Failed to send submission to judge ${judgeConnectionId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Abort a submission
   */
  abortSubmission(judgeConnectionId: string, submissionId: number): boolean {
    const socket = this.judgeConnections.get(judgeConnectionId);
    if (!socket) {
      this.logger.error(`No connection to judge ${judgeConnectionId}`);
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
  private async handleHandshake(
    judgeConnectionId: string,
    data: any,
  ): Promise<void> {
    this.logger.log(`=== HANDSHAKE DEBUG START for ${judgeConnectionId} ===`);
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
        this.sendHandshakeFailure(
          judgeConnectionId,
          'Missing judge name or key',
        );
        return;
      }

      // Verify JWT token
      this.logger.log(`Attempting JWT verification...`);
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
        this.sendHandshakeFailure(
          judgeConnectionId,
          'Invalid authentication token',
        );
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

        this.sendHandshakeFailure(
          judgeConnectionId,
          'Judge not found or invalid token',
        );
        return;
      }

      if (judge.status !== 'ACTIVE') {
        this.logger.error(
          `Judge ${judgeName} is not active (status: ${judge.status})`,
        );
        this.sendHandshakeFailure(judgeConnectionId, 'Judge is not active');
        return;
      }

      // Authentication successful
      this.logger.log(`🎉 Judge ${judgeName} authenticated successfully!`);

      // Add judge name to connected judges set
      this.connectedJudgeNames.add(judgeName);
      this.connectionIdToJudgeName.set(judgeConnectionId, judgeName);
      this.judgeNameToIdInDB.set(judgeName, judge.id);
      this.logger.log(
        `Added ${judgeName} to connected judges. Total connected: ${this.connectedJudgeNames.size}`,
      );

      // Store judge capabilities
      const problems = (data.problems || []).map((p: any) => p[0]); // Extract problem names
      const executors = data.executors || {};

      this.judgeCapabilities.set(judgeConnectionId, {
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
      this.logger.log(`Sending handshake success to ${judgeConnectionId}`);
      this.sendHandshakeSuccess(judgeConnectionId);

      // Set socket timeout to match DMOJ bridge behavior (60 seconds)
      const socket = this.judgeConnections.get(judgeConnectionId);
      if (socket) {
        socket.setTimeout(60000); // 60 seconds timeout
        this.logger.debug(
          `Set socket timeout to 60 seconds for judge ${judgeName}`,
        );
      }

      // Start ping thread to send pings to judge every 10 seconds (like DMOJ bridge does)
      this.startPingThread(judgeConnectionId, judgeName);

      // Emit event for successful authentication
      this.eventEmitter.emit('judge.authenticated', {
        judgeConnectionId: judgeConnectionId,
        judgeDbId: judge.id,
        judgeName,
        judge,
        data,
      });

      this.logger.log(`=== HANDSHAKE DEBUG END for ${judgeConnectionId} ===`);
    } catch (error) {
      this.logger.error(
        `Handshake error for judge ${judgeConnectionId}:`,
        error,
      );
      this.logger.error(`Error stack:`, error.stack);
      this.sendHandshakeFailure(judgeConnectionId, 'Internal server error');
    }
  }

  private sendHandshakeSuccess(judgeConnectionId: string): void {
    this.sendPacket(judgeConnectionId, 'handshake-success', {});
  }

  private sendHandshakeFailure(
    judgeConnectionId: string,
    reason: string,
  ): void {
    this.sendPacket(judgeConnectionId, 'handshake-failure', { reason });
    // Disconnect the judge after sending failure
    setTimeout(() => {
      const socket = this.judgeConnections.get(judgeConnectionId);
      if (socket) {
        socket.destroy();
        this.judgeConnections.delete(judgeConnectionId);

        // Remove from connected judges if it was added
        const judgeName = this.connectionIdToJudgeName.get(judgeConnectionId);
        if (judgeName) {
          this.connectedJudgeNames.delete(judgeName);
          this.connectionIdToJudgeName.delete(judgeConnectionId);
          if (this.judgeNameToIdInDB.has(judgeName))
            this.judgeNameToIdInDB.delete(judgeName);
        }
      }
    }, 100);
  }

  private handleSupportedProblems(
    judgeConnectionId: string,
    packet: any,
  ): void {
    this.logger.debug(`Judge ${judgeConnectionId} supports problems:`, packet);

    // Update the stored judge capabilities with new problem list
    const currentCapabilities = this.judgeCapabilities.get(judgeConnectionId);
    if (currentCapabilities) {
      // Extract problems from packet (support both flat and nested structure)
      const problems = Array.isArray(packet.problems)
        ? packet.problems.map((p: any) => (Array.isArray(p) ? p[0] : p)) // Handle [[problemId, ...]] format
        : Array.isArray(packet)
          ? packet.map((p: any) => (Array.isArray(p) ? p[0] : p))
          : [];

      // Update capabilities with new problem list
      currentCapabilities.problems = problems;
      this.judgeCapabilities.set(judgeConnectionId, currentCapabilities);

      const judgeName = this.getJudgeNameFromConnectionId(judgeConnectionId);
      this.logger.log(
        `✅ Updated capabilities for judge ${judgeName} (${judgeConnectionId}): ${problems.length} problems`,
      );
      this.logger.debug(`Problems: ${problems.join(', ')}`);
    } else {
      this.logger.warn(
        `Cannot update capabilities for judge ${judgeConnectionId}: no existing capabilities found`,
      );
    }

    this.eventEmitter.emit('judge.supported-problems', {
      judgeConnectionId: judgeConnectionId,
      problems: packet.problems || packet, // Support both flat and nested structure
    });
  }

  private handleCompileError(judgeConnectionId: string, data: any): void {
    this.logger.debug(`Compile error from judge ${judgeConnectionId}:`, data);
    const judgeName =
      this.getJudgeNameFromConnectionId(judgeConnectionId) || 'unknown';
    this.eventEmitter.emit('submission.compile-error', {
      judgeConnectionId: judgeConnectionId,
      judgeName,
      submissionId: data['submission-id'],
      error: data.log,
    });
  }

  private handleCompileMessage(judgeConnectionId: string, data: any): void {
    this.logger.debug(`Compile message from judge ${judgeConnectionId}:`, data);
    this.eventEmitter.emit('submission.compile-message', {
      judgeConnectionId: judgeConnectionId,
      submissionId: data['submission-id'],
      message: data.log,
    });
  }

  private handleBeginGrading(judgeConnectionId: string, data: any): void {
    this.logger.debug(`Begin grading from judge ${judgeConnectionId}:`, data);
    this.eventEmitter.emit('submission.begin-grading', {
      judgeConnectionId: judgeConnectionId,
      submissionId: data['submission-id'],
      isPretest: data.pretested || data['is-pretest'],
    });
  }

  private handleGradingEnd(judgeConnectionId: string, data: any): void {
    this.logger.debug(`Grading end from judge ${judgeConnectionId}:`, data);
    const judgeName =
      this.getJudgeNameFromConnectionId(judgeConnectionId) || 'unknown';
    this.eventEmitter.emit('submission.grading-end', {
      judgeConnectionId: judgeConnectionId,
      judgeName,
      submissionId: data['submission-id'],
    });
  }

  private handleBatchBegin(judgeConnectionId: string, data: any): void {
    this.logger.debug(`Batch begin from judge ${judgeConnectionId}:`, data);
    this.eventEmitter.emit('submission.batch-begin', {
      judgeConnectionId: judgeConnectionId,
      submissionId: data['submission-id'],
      batchNumber: data['batch-no'],
    });
  }

  private handleBatchEnd(judgeConnectionId: string, data: any): void {
    this.logger.debug(`Batch end from judge ${judgeConnectionId}:`, data);
    this.eventEmitter.emit('submission.batch-end', {
      judgeConnectionId: judgeConnectionId,
      submissionId: data['submission-id'],
      batchNumber: data['batch-no'],
    });
  }

  private handleTestCaseStatus(judgeConnectionId: string, data: any): void {
    this.logger.debug(
      `Test case status from judge ${judgeConnectionId}:`,
      data,
    );

    // DMOJ sends test-case-status with a cases array containing multiple test cases
    if (data.cases && Array.isArray(data.cases)) {
      data.cases.forEach((testCase: any) => {
        this.eventEmitter.emit('submission.test-case-status', {
          judgeConnectionId: judgeConnectionId,
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
        judgeConnectionId: judgeConnectionId,
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

  private handleSubmissionTerminated(
    judgeConnectionId: string,
    data: any,
  ): void {
    this.logger.debug(
      `Submission terminated from judge ${judgeConnectionId}:`,
      data,
    );
    this.eventEmitter.emit('submission.terminated', {
      judgeConnectionId: judgeConnectionId,
      submissionId: data['submission-id'],
    });
  }

  private handleSubmissionAborted(judgeConnectionId: string, data: any): void {
    this.logger.debug(
      `Submission aborted from judge ${judgeConnectionId}:`,
      data,
    );
    const judgeName =
      this.getJudgeNameFromConnectionId(judgeConnectionId) || 'unknown';
    this.eventEmitter.emit('submission.aborted', {
      judgeConnectionId: judgeConnectionId,
      judgeName,
      submissionId: data['submission-id'],
    });
  }

  private handleSubmissionAcknowledged(
    judgeConnectionId: string,
    packet: any,
  ): void {
    const submissionId = packet['submission-id'];
    this.logger.log(
      `✅ Submission ${submissionId} acknowledged by judge ${judgeConnectionId}`,
    );
    this.eventEmitter.emit('submission.acknowledged', {
      judgeConnectionId: judgeConnectionId,
      submissionId,
    });
  }

  private handlePingResponse(judgeConnectionId: string, packet: any): void {
    this.logger.debug(
      `📍 Ping response from judge ${judgeConnectionId}:`,
      packet,
    );

    // Reset socket timeout when we receive ping response (critical for keeping connection alive)
    const socket = this.judgeConnections.get(judgeConnectionId);
    if (socket) {
      socket.setTimeout(60000); // Reset timeout to 60 seconds like DMOJ does
      this.logger.debug(
        `🔄 Reset timeout for judge ${judgeConnectionId} on ping response`,
      );
    }

    // We could track latency here if needed: packet.when vs current time
  }

  /**
   * Start ping thread for a judge (like DMOJ bridge does)
   */
  private startPingThread(judgeConnectionId: string, judgeName: string): void {
    this.logger.debug(`🏓 Starting ping thread for judge ${judgeName}`);

    // Send ping every 10 seconds (matching DMOJ behavior)
    const pingInterval = setInterval(() => {
      const socket = this.judgeConnections.get(judgeConnectionId);
      if (!socket) {
        // Judge disconnected, stop the ping interval
        clearInterval(pingInterval);
        this.judgePingIntervals.delete(judgeConnectionId);
        this.logger.debug(
          `🏓 Stopped ping thread for disconnected judge ${judgeName}`,
        );
        return;
      }

      try {
        const pingPacket = {
          name: 'ping',
          when: Date.now() / 1000, // Current timestamp in seconds
        };

        const jsonData = JSON.stringify(pingPacket);
        const compressed = zlib.deflateSync(Buffer.from(jsonData));
        const size = Buffer.allocUnsafe(4);
        size.writeUInt32BE(compressed.length, 0);

        socket.write(Buffer.concat([size, compressed]));
        this.logger.debug(`🏓 Sent ping to judge ${judgeName}`);
      } catch (error) {
        this.logger.error(`Failed to send ping to judge ${judgeName}:`, error);
        // Stop the ping interval on error
        clearInterval(pingInterval);
        this.judgePingIntervals.delete(judgeConnectionId);
      }
    }, 10000); // 10 seconds interval

    // Store the interval so we can clear it later
    this.judgePingIntervals.set(judgeConnectionId, pingInterval);
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
   * Get judge name from connection ID
   */
  getJudgeNameFromConnectionId(judgeConnectionId: string): string | null {
    return this.connectionIdToJudgeName.get(judgeConnectionId) || null;
  }

  /**
   * Get judge ID from connection ID
   */
  getJudgeIdFromConnectionId(judgeConnectionId: string): string | null {
    const judgeName = this.connectionIdToJudgeName.get(judgeConnectionId);
    if (!judgeName) return null;
    return this.judgeNameToIdInDB.get(judgeName) || null;
  }

  /**
   * Get judge ID from judge name
   */
  getJudgeIdFromName(name: string): string | null {
    return this.judgeNameToIdInDB.get(name) || null;
  }

  /**
   * Get judge capabilities (problems and executors)
   */
  getJudgeCapabilities(
    judgeConnectionId?: string,
  ): JudgeCapabilities | Map<string, JudgeCapabilities> {
    if (judgeConnectionId) {
      return (
        this.judgeCapabilities.get(judgeConnectionId) || {
          problems: [],
          executors: {},
        }
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
  disconnectJudge(judgeConnectionId: string): void {
    const socket = this.judgeConnections.get(judgeConnectionId);
    if (socket) {
      socket.destroy();
      this.judgeConnections.delete(judgeConnectionId);
      this.judgeCapabilities.delete(judgeConnectionId);

      // Remove from connected judges
      const judgeName = this.connectionIdToJudgeName.get(judgeConnectionId);
      if (judgeName) {
        this.connectedJudgeNames.delete(judgeName);
        this.connectionIdToJudgeName.delete(judgeConnectionId);
      }

      // Stop ping interval
      const pingInterval = this.judgePingIntervals.get(judgeConnectionId);
      if (pingInterval) {
        clearInterval(pingInterval);
        this.judgePingIntervals.delete(judgeConnectionId);
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

    // Clear all ping intervals
    for (const [, interval] of this.judgePingIntervals) {
      clearInterval(interval);
    }
    this.judgePingIntervals.clear();
  }
}
