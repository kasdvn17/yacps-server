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

@WebSocketGateway()
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
}
