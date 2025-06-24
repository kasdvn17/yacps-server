import { PrismaService } from '@/prisma/prisma.service';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class JAuthGuard implements CanActivate {
  private readonly logger = new Logger(JAuthGuard.name);
  constructor(
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const token = client.handshake.auth.token;
    if (!token) throw new WsException('INVALID_TOKEN');
    try {
      const payload = await this.jwtService.verifyAsync(token); // payload.id, payload.name, payload.createdAt
      const judge = await this.prismaService.judge.findFirst({
        where: {
          token: {
            id: payload.id,
            createdAt: payload.createdAt,
          },
        },
      });
      if (!judge) throw new WsException('INVALID_TOKEN');
      if (judge.status != 'ACTIVE') throw new WsException('JUDGE_DISABLED');
      client.data['judge'] = judge;
      return true;
    } catch (err) {
      this.logger.error(err);
      throw new WsException('UNKNOWN_ERROR');
    }
  }
}
