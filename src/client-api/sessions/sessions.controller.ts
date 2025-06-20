import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
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

@Controller()
@UseGuards(AuthGuard, ThrottlerGuard)
export class SessionsController {
  constructor(
    private prismaService: PrismaService,
    private sessionsService: SessionsService,
    private usersService: UsersService,
    private argon2Service: Argon2Service,
    private jwtService: JwtService,
  ) {}

  @Post('/')
  @Public()
  @Throttle({ 
    default: { 
      limit: 5, 
      ttl: 60000,
      getTracker: (req) => {
        // Try to get real IP from various headers
        const xForwardedFor = req.headers['x-forwarded-for'];
        const xRealIp = req.headers['x-real-ip'];
        const cfConnectingIp = req.headers['cf-connecting-ip'];
        const xConnectingIp = req.headers['x-connecting-ip'];
        
        // Return first valid IP found
        if (cfConnectingIp && typeof cfConnectingIp === 'string') {
          return cfConnectingIp;
        }
        if (xConnectingIp && typeof xConnectingIp === 'string') {
          return xConnectingIp;
        }
        if (xRealIp && typeof xRealIp === 'string') {
          return xRealIp;
        }
        if (xForwardedFor) {
          // X-Forwarded-For can contain multiple IPs, get the first one
          const forwarded = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
          const firstIp = forwarded.split(',')[0].trim();
          if (firstIp) return firstIp;
        }
        
        // Fallback to connection IP
        return req.ip || req.connection?.remoteAddress || 'unknown';
      }
    } 
  }) // 5 login attempts per minute per real IP
  async createNewSession(@Body() body: CreateSessionDTO, @RealIP() ip: string) {
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
      const session = await this.sessionsService.createSession(
        user.id,
        ip,
        true,
      );
      const token = await this.jwtService.signAsync(session);
      return { data: token };
    } catch (err) {
      console.log(err);
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
}
