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

@Controller()
export class SessionsController {
  constructor(
    private prismaService: PrismaService,
    private sessionsService: SessionsService,
    private usersService: UsersService,
    private bcryptService: BcryptService,
    private jwtService: JwtService,
  ) {}

  @Post('/')
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
  @UseGuards(AuthGuard)
  getCurrentSession(@Req() req: Request) {
    const response = {
      ...req['session'],
    };
    delete response.user;
    return response;
  }

  @Delete('/me')
  destroyCurrentSession() {}

  // get all sessions of the currently logged in users
  @Get('/all')
  getAllSessions() {}

  @Get('/find')
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
