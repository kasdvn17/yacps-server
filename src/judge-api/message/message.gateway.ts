import { Logger, UseGuards } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JAuthGuard } from '../auth/auth.guard';
import { OnEvent } from '@nestjs/event-emitter';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/submissions',
})
export class MessageGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MessageGateway.name);

  @WebSocketServer() server: Server;

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @UseGuards(JAuthGuard)
  @SubscribeMessage('message')
  handleEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ): void {
    this.logger.debug(client.data.judge);
    this.logger.debug(client.id);
    this.logger.debug(data);
  }

  // Subscription management
  @SubscribeMessage('subscribe-submission')
  handleSubscribeSubmission(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { submissionId: number },
  ): void {
    const room = `submission-${data.submissionId}`;
    void client.join(room);
    this.logger.debug(
      `Client ${client.id} subscribed to submission ${data.submissionId}`,
    );
  }

  @SubscribeMessage('unsubscribe-submission')
  handleUnsubscribeSubmission(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { submissionId: number },
  ): void {
    const room = `submission-${data.submissionId}`;
    void client.leave(room);
    this.logger.debug(
      `Client ${client.id} unsubscribed from submission ${data.submissionId}`,
    );
  }

  @SubscribeMessage('subscribe-user-submissions')
  handleSubscribeUserSubmissions(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ): void {
    const room = `user-submissions-${data.userId}`;
    void client.join(room);
    this.logger.debug(
      `Client ${client.id} subscribed to user ${data.userId} submissions`,
    );
  }

  // Event handlers for live updates
  @OnEvent('submission.created')
  handleSubmissionCreated(data: {
    submissionId: number;
    authorId: string;
    problemId: number;
    timestamp: Date;
  }) {
    // Notify users subscribed to this user's submissions
    this.server
      .to(`user-submissions-${data.authorId}`)
      .emit('submission-created', data);

    // Notify the specific submission room
    this.server
      .to(`submission-${data.submissionId}`)
      .emit('submission-created', data);
  }

  @OnEvent('submission.update')
  handleSubmissionUpdate(data: {
    submissionId: number;
    verdict?: string;
    points?: number;
    maxPoints?: number;
    maxTime?: number;
    maxMemory?: number;
    errorMessage?: string;
    timestamp: Date;
  }) {
    this.server
      .to(`submission-${data.submissionId}`)
      .emit('submission-update', data);
  }

  @OnEvent('submission.test-case-update')
  handleTestCaseUpdate(data: {
    submissionId: number;
    caseNumber: number;
    batchNumber?: number;
    verdict: string;
    time?: number;
    memory?: number;
    points?: number;
    totalPoints?: number;
    feedback?: string;
    timestamp: Date;
  }) {
    this.server
      .to(`submission-${data.submissionId}`)
      .emit('test-case-update', data);
  }

  @OnEvent('judge.status-update')
  handleJudgeStatusUpdate(data: {
    judgeId: string;
    status: string;
    timestamp: Date;
  }) {
    // Broadcast judge status to all connected clients
    this.server.emit('judge-status-update', data);
  }
}
