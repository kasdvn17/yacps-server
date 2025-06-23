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
  ForbiddenException,
} from '@nestjs/common';
import { CreateUserDTO } from './users.dto';
import { UsersService } from './users.service';
import { PrismaService } from '@/prisma/prisma.service';
import { Argon2Service } from '../argon2/argon2.service';
import { Perms, Public } from '../auth/auth.decorator';
import { AuthGuard } from '../auth/auth.guard';
import { HCaptchaService } from '../hcaptcha/hcaptcha.service';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { getRealIp } from '../utils';
import { Config } from 'config';
import { PermissionsService } from '../auth/permissions.service';
import { UserPermissions } from 'constants/permissions';

@Controller()
@UseGuards(AuthGuard, ThrottlerGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private prismaService: PrismaService,
    private usersService: UsersService,
    private argon2Service: Argon2Service,
    private hcaptchaService: HCaptchaService,
    private permissionsService: PermissionsService,
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
    if (!Config.ENABLE_USER_SELF_REGISTRATIONS)
      throw new ForbiddenException('SELF_REGISTRATION_DISABLED');
    if (Config.ENABLE_CAPTCHA) {
      //Require hCaptcha token
      if (!body.captchaToken) {
        throw new BadRequestException('INVALID_CAPTCHA');
      }
      const captchaValid = await this.hcaptchaService.verifyCaptcha(
        body.captchaToken,
        body.clientIp,
      );
      if (!captchaValid) {
        throw new BadRequestException('INVALID_CAPTCHA');
      }
    }

    const usedUsername = await this.usersService.findUser(
      {
        username: body.username,
      },
      undefined,
    );
    if (usedUsername != null && usedUsername.id)
      throw new ConflictException('USERNAME_UNAVAILABLE');

    const usedEmail = await this.usersService.findUser({
      email: body.email,
    });
    if (usedEmail != null && usedEmail.id)
      throw new ConflictException('EMAIL_IN_USE');

    const hashed = await this.argon2Service.hashPassword(body.password);
    try {
      await this.prismaService.user.create({
        data: {
          email: body.email,
          username: body.username,
          fullname: body.fullname || null,
          password: hashed,
          status: Config.ENABLE_MAIL_CONFIRMATION ? 'CONF_AWAITING' : 'ACTIVE',
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

  @Post('/force')
  @UseGuards(AuthGuard)
  @Perms([UserPermissions.CREATE_NEW_USERS])
  async forceCreateUser(@Body() body: CreateUserDTO) {
    const usedUsername = await this.usersService.findUser(
      {
        username: body.username,
      },
      undefined,
    );
    if (usedUsername != null && usedUsername.id)
      throw new ConflictException('USERNAME_UNAVAILABLE');

    const usedEmail = await this.usersService.findUser({
      email: body.email,
    });
    if (usedEmail != null && usedEmail.id)
      throw new ConflictException('EMAIL_IN_USE');

    const hashed = await this.argon2Service.hashPassword(body.password);
    try {
      await this.prismaService.user.create({
        data: {
          email: body.email,
          username: body.username,
          fullname: body.fullname || null,
          password: hashed,
          status: Config.ENABLE_MAIL_CONFIRMATION ? 'CONF_AWAITING' : 'ACTIVE',
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
