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
    const token = client.handshake.auth.judge_token;
    const name = client.handshake.auth.judge_name;
    if (!token || !name) throw new WsException('INVALID_CREDENTIALS');
    try {
      const payload = await this.jwtService.verifyAsync(token); // payload.id, payload.name, payload.createdAt
      const judge = await this.prismaService.judge.findFirst({
        where: {
          name,
          token: {
            id: payload.id,
            createdAt: payload.createdAt,
          },
        },
      });
      if (!judge) throw new WsException('INVALID_CREDENTIALS');
      if (judge.status != 'ACTIVE') throw new WsException('JUDGE_UNAVAILABLE');
      client.data['judge'] = judge;
      return true;
    } catch (err) {
      if (err instanceof WsException) throw new WsException(err.getError());
      else {
        this.logger.error(err);
        throw new WsException('INVALID_CREDENTIALS');
      }
    }
  }
}
