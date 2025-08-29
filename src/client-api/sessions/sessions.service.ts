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

  /**
   * Creates a new session for the user.
   * @param userId - The ID of the user.
   * @param ip - The IP address of the user.
   * @param skipCheckUser - If true, skips checking if the user exists.
   * @param userAgent - The user agent string of the client.
   * @returns The created session.
   */
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
      throw new InternalServerErrorException('UNKNOWN_ERROR', err.message);
    }
  }

  /**
   * Deletes a session by its ID.
   * @param sessionId - The ID of the session to delete.
   */
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
      throw new InternalServerErrorException('UNKNOWN_ERROR', err.message);
    }
  }

  /**
   * Deletes all sessions for a user, optionally excluding a specific session ID.
   * @param userId - The ID of the user whose sessions are to be deleted.
   * @param excludeSessionId - An optional session ID to exclude from deletion.
   * @returns The number of sessions deleted.
   */
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
      throw new InternalServerErrorException('UNKNOWN_ERROR', err.message);
    }
  }

  /**
   * Finds a session by its ID and includes the user information.
   * @param id - The ID of the session to find.
   * @returns The session with user information or null if not found.
   */
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
      throw new InternalServerErrorException('UNKNOWN_ERROR', err.message);
    }
  }

  /**
   * Finds a session by its ID.
   * @param id - The ID of the session to find.
   * @returns The session or null if not found.
   */
  async findSessionById(id: string): Promise<Session | null> {
    try {
      return await this.prismaService.session.findUnique({
        where: {
          id,
        },
      });
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err.message);
    }
  }

  /**
   * Finds a session based on the provided fields.
   * @param fields - Partial session fields to match.
   * @returns The session or null if not found.
   */
  async findSession(fields: Partial<Session>): Promise<Session | null> {
    try {
      return await this.prismaService.session.findFirst({
        where: fields,
      });
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err.message);
    }
  }

  /**
   * Finds a session with user information based on the provided fields.
   * @param fields - Partial session fields to match.
   * @returns The session with user information or null if not found.
   */
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
      throw new InternalServerErrorException('UNKNOWN_ERROR', err.message);
    }
  }

  /**
   * Finds multiple sessions based on the provided fields.
   * @param fields - Partial session fields to match.
   * @param limit - The maximum number of sessions to return.
   * @returns An array of sessions matching the criteria.
   */
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
      throw new InternalServerErrorException('UNKNOWN_ERROR', err.message);
    }
  }
}
