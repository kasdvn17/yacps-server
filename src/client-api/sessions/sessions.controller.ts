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
import { BcryptService } from '../bcrypt/bcrypt.service';
import { RealIP } from 'nestjs-real-ip';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '../auth/auth.guard';
import { Request } from 'express';
import { Perms, Public } from '../auth/auth.decorator';
import { UserPermissions } from 'constants/permissions';

@Controller()
@UseGuards(AuthGuard)
export class SessionsController {
  constructor(
    private prismaService: PrismaService,
    private sessionsService: SessionsService,
    private usersService: UsersService,
    private bcryptService: BcryptService,
    private jwtService: JwtService,
  ) {}

  @Post('/')
  @Public()
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
    if (!(await this.bcryptService.comparePassword(body.password, hashed)))
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

  // get all sessions of the currently logged in users
  @Get('/all')
  async getMySessions(@Req() req: Request) {
    const userId: string = req['user'].id;
    return await this.sessionsService.findSessions({
      userId,
    });
  }

  @Get('/find')
  @Perms([UserPermissions.VIEW_USER_SESSIONS])
  // TODO: Only users with VIEW_USER_SESSIONS permissions can do this request
  async findSessions(@Query() queries: Partial<Session>) {
    Object.keys(queries).map(([v]) => {
      if (!(v in this.prismaService.session.fields))
        throw new BadRequestException('INVALID_QUERY');
    });
    const data = await this.sessionsService.findSessions(queries);
    return data;
  }
}
