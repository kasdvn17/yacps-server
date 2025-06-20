import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { CreateSessionDTO } from './sessions.dto';
import { Session } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { Argon2Service } from '../argon2/argon2.service';
import { RealIP } from 'nestjs-real-ip';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '../auth/auth.guard';
import { Request } from 'express';
import { Perms, Public } from '../auth/auth.decorator';
import { UserPermissions } from 'constants/permissions';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { getRealIp } from '../utils';
import { HCaptchaService } from '../hcaptcha/hcaptcha.service';

@Controller()
@UseGuards(AuthGuard, ThrottlerGuard)
export class SessionsController {
  private readonly logger = new Logger(SessionsController.name);
  constructor(
    private prismaService: PrismaService,
    private sessionsService: SessionsService,
    private usersService: UsersService,
    private argon2Service: Argon2Service,
    private jwtService: JwtService,
    private hcaptchaService: HCaptchaService,
  ) {}

  @Post('/')
  @Public()
  // 5 login attempts per minute per real IP
  @Throttle({
    default: {
      limit: 5,
      ttl: 60000,
      getTracker: getRealIp,
    },
  })
  async createNewSession(@Body() body: CreateSessionDTO) {
    // Verify hCaptcha if token is provided
    if (body.captchaToken) {
      const captchaValid = await this.hcaptchaService.verifyCaptcha(
        body.captchaToken,
        body.clientIp
      );
      if (!captchaValid) {
        throw new BadRequestException('Invalid captcha');
      }
    }

    const user = await this.usersService.findUser(
      {
        email: body.email,
      },
      false,
      true,
    );
    if (!user) throw new NotFoundException('INCORRECT_CREDENTIALS');
    const hashed = user.password;
    if (!(await this.argon2Service.comparePassword(body.password, hashed)))
      throw new NotFoundException('INCORRECT_CREDENTIALS');
    try {
      // Use clientIp from payload, fallback to 'unknown' if not provided
      const clientIp = body.clientIp || 'unknown';
      
      const session = await this.sessionsService.createSession(
        user.id,
        clientIp,
        true,
        body.userAgent,
      );
      const token = await this.jwtService.signAsync(session);
      return { data: token };
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err);
    }
  }

  @Get('/me')
  getCurrentSession(@Req() req: Request) {
    const response = {
      ...req['session'],
    };
    delete response.user;
    return response;
  }

  @Delete('/me')
  async destroyCurrentSession(@Req() req: Request) {
    await this.sessionsService.deleteSession(req['session'].id);
  }

  @Get('/all')
  async getMySessions(@Req() req: Request) {
    const userId: string = req['user'].id;
    return await this.sessionsService.findSessions({
      userId,
    });
  }

  @Get('/find')
  @Perms([UserPermissions.VIEW_USER_SESSIONS])
  async findSessions(@Query() queries: Partial<Session>) {
    Object.keys(queries).map(([v]) => {
      if (!(v in this.prismaService.session.fields))
        throw new BadRequestException('INVALID_QUERY');
    });
    const data = await this.sessionsService.findSessions(queries);
    return data;
  }

  @Delete('/all')
  async destroyAllSessions(@Req() req: Request) {
    const userId: string = req['user'].id;
    const currentSessionId: string = req['session'].id;

    // Delete all sessions except the current one to keep user logged in
    const deletedCount = await this.sessionsService.deleteAllUserSessions(userId, currentSessionId);

    return {
      message: 'All other sessions have been terminated',
      deletedSessions: deletedCount,
    };
  }
}
