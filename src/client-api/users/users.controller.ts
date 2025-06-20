import {
  Body,
  ConflictException,
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { CreateUserDTO } from './users.dto';
import { UsersService } from './users.service';
import { PrismaService } from '@/prisma/prisma.service';
import { Argon2Service } from '../argon2/argon2.service';
import { Public } from '../auth/auth.decorator';
import { AuthGuard } from '../auth/auth.guard';
import { HCaptchaService } from '../hcaptcha/hcaptcha.service';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { getRealIp } from '../utils';

@Controller()
@UseGuards(AuthGuard, ThrottlerGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private prismaService: PrismaService,
    private usersService: UsersService,
    private argon2Service: Argon2Service,
    private hcaptchaService: HCaptchaService,
  ) {}

  @Post('/')
  @Public()
  // 3 signup attempts per minute per real IP
  @Throttle({
    default: {
      limit: 3,
      ttl: 60000,
      getTracker: getRealIp,
    },
  })
  async createUser(@Body() body: CreateUserDTO) {
    // Require hCaptcha token
    if (!body.captchaToken) {
      throw new BadRequestException('Captcha token is required');
    }
    const captchaValid = await this.hcaptchaService.verifyCaptcha(
      body.captchaToken,
      body.clientIp,
    );
    if (!captchaValid) {
      throw new BadRequestException('Invalid captcha');
    }

    const not_unique = await this.prismaService.user.findFirst({
      where: {
        OR: [{ username: body.username }, { email: body.email }],
      },
    });
    if (not_unique != null && not_unique.id)
      throw new ConflictException('EMAIL_OR_USERNAME_EXISTS');
    const hashed = await this.argon2Service.hashPassword(body.password);
    try {
      await this.prismaService.user.create({
        data: {
          email: body.email,
          username: body.username,
          fullname: body.fullname || null,
          password: hashed,
        },
        omit: {
          password: true,
        },
      });
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err);
    }
  }

  @Get('/me')
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
