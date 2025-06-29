import { PrismaService } from '@/prisma/prisma.service';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Session } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { Config } from 'config';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  constructor(
    private prismaService: PrismaService,
    private usersService: UsersService,
  ) {}

  async createSession(
    userId: string,
    ip: string,
    skipCheckUser: boolean = false,
    userAgent?: string,
  ): Promise<Session> {
    if (!skipCheckUser) {
      const user = await this.usersService.findUser(
        {
          id: userId,
          isDeleted: false,
          status: 'ACTIVE',
        },
        false,
        true,
      );
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
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err);
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
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err);
    }
  }

  async deleteAllUserSessions(userId: string, excludeSessionId?: string) {
    try {
      const deleteResult = await this.prismaService.session.deleteMany({
        where: {
          userId,
          NOT:
            typeof excludeSessionId == 'string'
              ? {
                  id: excludeSessionId,
                }
              : undefined,
        },
      });

      return deleteResult.count;
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err);
    }
  }

  async findSessionByIdWithUser(id: string) {
    try {
      return await this.prismaService.session.findUnique({
        where: {
          id,
        },
        include: {
          user: true,
        },
      });
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err);
    }
  }

  async findSessionById(id: string): Promise<Session | null> {
    try {
      return await this.prismaService.session.findUnique({
        where: {
          id,
        },
      });
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err);
    }
  }

  async findSession(fields: Partial<Session>): Promise<Session | null> {
    try {
      return await this.prismaService.session.findFirst({
        where: fields,
      });
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err);
    }
  }

  async findSessionWithUser(fields: Partial<Session>) {
    try {
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
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err);
    }
  }

  async findSessions(
    fields: Partial<Session>,
    limit: number = 10,
  ): Promise<Session[]> {
    try {
      const sessions = await this.prismaService.session.findMany({
        where: fields,
        take: limit,
      });
      return sessions;
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err);
    }
  }
}
