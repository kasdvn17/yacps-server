import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Session } from '@prisma/client';
import { ResponseCodes } from 'constants/response_code';
import { UsersService } from '../users/users.service';
import { Config } from 'config';

@Injectable()
export class SessionsService {
  constructor(
    private prismaService: PrismaService,
    private userService: UsersService,
  ) {}

  async createSession(
    userId: string,
    ip: string,
  ): Promise<{ code: ResponseCodes; data?: Session }> {
    const user = await this.userService.findUser({
      id: userId,
    });
    if (!user) return { code: ResponseCodes.USER_NOT_FOUND };
    let session: Session | null;
    try {
      session = await this.prismaService.session.create({
        data: {
          ip,
          userId: user.id,
          expiresAt: new Date(Date.now() + Config.SESSION_EXPIRES_MS),
        },
      });
      return { code: ResponseCodes.SUCCESS, data: session };
    } catch (err) {
      console.log(err);
      return { code: ResponseCodes.UNKNOWN_ERROR };
    }
  }

  async deleteSession(sessionId: string): Promise<ResponseCodes> {
    try {
      await this.prismaService.session.delete({
        where: {
          id: sessionId,
        },
      });
      return ResponseCodes.SUCCESS;
    } catch (err) {
      console.log(err);
      return ResponseCodes.UNKNOWN_ERROR;
    }
  }

  async findSessions(fields: Partial<Session>): Promise<Session[]> {
    const sessions = await this.prismaService.session.findMany({
      where: fields,
    });
    return sessions;
  }

  async sessionLogOut(sessionId: string): Promise<ResponseCodes> {
    try {
      await this.prismaService.session.update({
        where: {
          id: sessionId,
          isLoggedOut: false,
        },
        data: {
          isLoggedOut: true,
        },
      });
      return ResponseCodes.SUCCESS;
    } catch (err) {
      console.log(err);
      return ResponseCodes.UNKNOWN_ERROR;
    }
  }
}
