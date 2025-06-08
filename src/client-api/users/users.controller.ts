import {
  Body,
  ConflictException,
  Controller,
  Get,
  InternalServerErrorException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateUserDTO } from './users.dto';
import { UsersService } from './users.service';
import { PrismaService } from '@/prisma/prisma.service';
import { BcryptService } from '../bcrypt/bcrypt.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller()
export class UsersController {
  constructor(
    private prismaService: PrismaService,
    private usersService: UsersService,
    private bcryptService: BcryptService,
  ) {}

  @Post('/')
  async createUser(@Body() body: CreateUserDTO) {
    const not_unique = await this.prismaService.user.findFirst({
      where: {
        OR: [{ username: body.username }, { email: body.email }],
      },
    });
    if (not_unique != null && not_unique.id)
      throw new ConflictException('EMAIL_OR_USERNAME_EXISTS');
    const hashed = await this.bcryptService.hashPassword(body.password);
    try {
      await this.prismaService.user.create({
        data: {
          email: body.email,
          username: body.username,
          fullname: body.fullname,
          password: hashed,
        },
        omit: {
          password: true,
        },
      });
    } catch (err) {
      console.log(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err);
    }
  }

  @Get('/me')
  @UseGuards(AuthGuard)
  getCurrentUser(@Req() req: Request) {
    const response = {
      ...req['user'],
      perms: req['user'].perms.toString(),
    };
    delete response.password;
    delete response.isDeleted;
    return response;
  }
}
