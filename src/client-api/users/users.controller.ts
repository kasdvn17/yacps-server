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
  Param,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDTO } from './users.dto';
import { UsersService } from './users.service';
import { PrismaService } from '@/prisma/prisma.service';
import { Argon2Service } from '../argon2/argon2.service';
import { Perms, Public } from '../auth/auth.decorator';
import { AuthGuard } from '../auth/auth.guard';
import { TurnstileService } from '../turnstile/turnstile.service';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { getRealIp } from '../utils';
import { Config } from 'config';
import { UserPermissions } from 'constants/permissions';

@Controller()
@UseGuards(AuthGuard, ThrottlerGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private prismaService: PrismaService,
    private usersService: UsersService,
    private argon2Service: Argon2Service,
    private turnstileService: TurnstileService,
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

    const usedUsername = await this.usersService.findUser(
      {
        username: body.username,
      },
      undefined,
      undefined,
    );
    if (usedUsername != null && usedUsername.id)
      throw new ConflictException('USERNAME_UNAVAILABLE');

    const usedEmail = await this.usersService.findUser(
      {
        email: body.email,
      },
      false,
      undefined,
    );
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
  @Perms([UserPermissions.FORCE_CREATE_USERS])
  async forceCreateUser(@Body() body: CreateUserDTO) {
    const usedUsername = await this.usersService.findUser(
      {
        username: body.username,
      },
      undefined,
      undefined,
    );
    if (usedUsername != null && usedUsername.id)
      throw new ConflictException('USERNAME_UNAVAILABLE');

    const usedEmail = await this.usersService.findUser(
      {
        email: body.email,
      },
      true,
      undefined,
    );
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

  @Get('/details/:username')
  @Public()
  async getUserDetails(@Param('username') username: string) {
    try {
      // Find the user by username
      const user = await this.usersService.findUser({ username }, false, false);

      if (!user) {
        throw new NotFoundException('USER_NOT_FOUND');
      }

      // Get user submissions with problem and author details
      const submissions = await this.prismaService.submission.findMany({
        where: {
          authorId: user.id,
        },
        include: {
          problem: {
            select: {
              id: true,
              slug: true,
              name: true,
              points: true,
              category: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Calculate total points from submissions
      const totalPoints = submissions.reduce((sum, submission) => {
        return sum + (submission.points || 0);
      }, 0);

      // // Calculate user rank by points (simplified - could be optimized)
      // // Since we don't have a totalPoints field, we need to calculate it for all users
      // const allUsers = await this.prismaService.user.findMany({
      //   where: {
      //     isDeleted: false,
      //   },
      //   include: {
      //     submissions: {
      //       select: {
      //         points: true,
      //       },
      //     },
      //   },
      // });

      // const usersWithPoints = allUsers.map((u) => ({
      //   id: u.id,
      //   totalPoints: u.submissions.reduce(
      //     (sum, sub) => sum + (sub.points || 0),
      //     0,
      //   ),
      // }));

      // const usersWithMorePoints = usersWithPoints.filter(
      //   (u) => u.totalPoints > totalPoints,
      // );
      // const userRank = usersWithMorePoints.length + 1;

      // Transform submissions to match frontend interface
      const transformedSubmissions = submissions.map((submission) => ({
        problemCode: submission.problem.slug,
        problemName: submission.problem.name,
        problemCategory: submission.problem.category?.name || 'Uncategorized',
        status: submission.verdict || 'QU',
        points: submission.points || 0,
        language: submission.language,
        timestamp: submission.createdAt.getTime(),
      }));

      return {
        totalPoints,
        // rankByPoints: userRank,
        submissions: transformedSubmissions,
        bio: '', // User model doesn't have bio field
        avatarURL: '', // User model doesn't have avatarURL field
      };
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err);
    }
  }
}
