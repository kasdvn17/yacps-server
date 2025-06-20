import { PrismaService } from '@/prisma/prisma.service';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Session } from '@prisma/client';
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
    skipCheckUser: boolean = false,
    userAgent?: string,
  ): Promise<Session> {
    if (!skipCheckUser) {
      const user = await this.userService.findUser({
        id: userId,
      });
      if (!user) throw new NotFoundException('USER_NOT_FOUND');
    }
    let session: Session | null;
    try {
      session = await this.prismaService.session.create({
        data: {
          ip,
          userId,
          userAgent: userAgent || 'Unknown',
          expiresAt: new Date(Date.now() + Config.SESSION_EXPIRES_MS),
        },
      });
      return session;
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }

  async deleteSession(sessionId: string) {
    try {
      const deleteResult = await this.prismaService.session.deleteMany({
        where: {
          id: sessionId,
        },
      });
      if (deleteResult.count == 0)
        throw new NotFoundException('SESSION_NOT_FOUND');
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }

  async deleteAllUserSessions(userId: string, excludeSessionId?: string) {
    try {
      const whereClause: any = { userId };

      // Optionally exclude the current session to keep user logged in
      if (excludeSessionId) {
        whereClause.NOT = { id: excludeSessionId };
      }

      const deleteResult = await this.prismaService.session.deleteMany({
        where: whereClause,
      });

      return deleteResult.count;
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }

  async findSession(fields: Partial<Session>): Promise<Session | null> {
    return await this.prismaService.session.findFirst({
      where: fields,
    });
  }

  async findSessionWithUser(fields: Partial<Session>) {
    return await this.prismaService.session.findFirst({
      where: {
        ...fields,
        user: {
          isDeleted: false,
        },
      },
      include: {
        user: true,
      },
    });
  }

  async findSessions(
    fields: Partial<Session>,
    limit: number = 10,
  ): Promise<Session[]> {
    const sessions = await this.prismaService.session.findMany({
      where: fields,
      take: limit,
    });
    return sessions;
  }
}
