import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '../auth/auth.guard';
import { Request } from 'express';
import { Perms, Public } from '../auth/auth.decorator';
import { UserPermissions } from 'constants/permissions';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { getRealIp } from '../utils';
import { TurnstileService } from '../turnstile/turnstile.service';
import { Config } from 'config';
import { RealIP } from 'nestjs-real-ip';

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
    private turnstileService: TurnstileService,
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
  async createNewSession(
    @Req() req: Request,
    @Body() body: CreateSessionDTO,
    @RealIP() no_captcha_ip: string,
  ) {
    if (Config.ENABLE_CAPTCHA) {
      //Require Turnstile token
      if (!body.captchaToken) {
        throw new BadRequestException('INVALID_CAPTCHA');
      }
      const captchaValid = await this.turnstileService.verify(
        body.captchaToken,
        body.clientIp,
      );
      if (!captchaValid) {
        throw new BadRequestException('INVALID_CAPTCHA');
      }
    }

    const user = await this.usersService.findUser(
      {
        email: body.email,
        status: 'ACTIVE',
        isDeleted: false,
      },
      false,
      true,
    );
    if (!user) throw new NotFoundException('INCORRECT_CREDENTIALS');
    const hashed = user.password;
    if (!(await this.argon2Service.comparePassword(body.password, hashed)))
      throw new NotFoundException('INCORRECT_CREDENTIALS');
    // Use clientIp from payload, fallback to 'unknown' if not provided
    let clientIp = body.clientIp;
    if (!clientIp && Config.ENABLE_CAPTCHA) clientIp = 'unknown';

    const session = await this.sessionsService.createSession(
      user.id,
      clientIp || no_captcha_ip || getRealIp(req) || 'unknown',
      true,
      body.userAgent,
    );
    const token = await this.jwtService.signAsync(session);
    return { data: token };
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
    await this.sessionsService.deleteAllUserSessions(userId, currentSessionId);
  }
}
