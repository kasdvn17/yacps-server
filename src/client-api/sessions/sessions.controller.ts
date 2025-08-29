import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { Session, User } from '@prisma/client';
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
import { LoggedInUser } from '../users/users.decorator';

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

  /**
   * Create a new session
   * @param req The request object
   * @param body The data for new session
   * @param no_captcha_ip The IP extracted from the request if Turnstile is not enabled
   * @returns The token for the new session
   */
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

    if (user.status == 'CONF_AWAITING')
      throw new ForbiddenException('ACCOUNT_AWAITING_CONFIRMATION');
    if (user.status == 'BANNED') throw new ForbiddenException('ACCOUNT_BANNED');
    if (user.status == 'DISABLED')
      throw new ForbiddenException('ACCOUNT_DISABLED');

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

  /**
   * Get the current session details
   * @param req The request object
   * @returns The current session details
   */
  @Get('/me')
  getCurrentSession(@Req() req: Request) {
    const response = {
      ...req['session'],
    };
    delete response.user;
    return response;
  }

  /**
   * Delete the current session
   * @param req The request object
   */
  @Delete('/me')
  async destroyCurrentSession(@Req() req: Request) {
    await this.sessionsService.deleteSession(req['session'].id);
  }

  /**
   * Get all sessions for the logged-in user
   * @param req The request object
   * @param user The logged-in user
   */
  @Get('/all')
  async getMySessions(@Req() req: Request, @LoggedInUser() user: User) {
    const userId: string = user.id;
    return await this.sessionsService.findSessions({
      userId,
    });
  }

  /**
   * Find sessions based on query parameters
   * @param queries The query parameters to filter sessions
   */
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

  /**
   * Delete all sessions for the logged-in user except the current one
   * @param req The request object
   * @param user The logged-in user
   */
  @Delete('/all')
  async destroyAllSessions(@Req() req: Request, @LoggedInUser() user: User) {
    const userId: string = user.id;
    const currentSessionId: string = req['session'].id;

    // Delete all sessions except the current one to keep user logged in
    await this.sessionsService.deleteAllUserSessions(userId, currentSessionId);
  }
}
