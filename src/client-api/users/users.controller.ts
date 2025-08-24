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
import * as crypto from 'crypto';

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

  /**
   * Create a new user
   * @param body The body of the request containing user details for registration.
   */
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
          defaultRuntime: body.defaultRuntime,
          status: Config.ENABLE_MAIL_CONFIRMATION ? 'CONF_AWAITING' : 'ACTIVE',
        },
      });
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err);
    }
  }

  /**
   * Force create a user (admin only)
   * @param body The body of the request containing user details for registration.
   */
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

  /**
   * Get the current user details
   * @param req The request object containing user information.
   */
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

  /**
   * Get user details by username
   * @param username The username of the user to retrieve details for.
   * @returns User details including submissions and total points.
   */
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

      // Calculate total points from submissions by taking the highest score per problem
      // and count problemsSolved as unique problems with at least one AC verdict.
      const maxPointsByProblem = new Map<string, number>();
      const solvedProblems = new Set<string>();
      submissions.forEach((submission) => {
        const slug = submission.problem?.slug;
        if (!slug) return;
        const pts = submission.points || 0;
        const current = maxPointsByProblem.get(slug) || 0;
        if (pts > current) {
          maxPointsByProblem.set(slug, pts);
        }
        // Consider a problem solved if any submission for that problem has verdict AC
        if (submission.verdict === 'AC') {
          solvedProblems.add(slug);
        }
      });

      const totalPoints = Array.from(maxPointsByProblem.values()).reduce(
        (sum, p) => sum + p,
        0,
      );
      const problemsSolved = solvedProblems.size;

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
        problemSlug: submission.problem.slug,
        problemName: submission.problem.name,
        problemCategory: submission.problem.category?.name || 'Uncategorized',
        status: submission.verdict || 'QU',
        points: submission.points || 0,
        language: submission.language,
        timestamp: submission.createdAt.getTime(),
      }));

      return {
        totalPoints,
        problemsSolved,
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

  @Get('/avatar/:username')
  @Public()
  async getUserAvatar(@Param('username') username: string) {
    try {
      const user = await this.usersService.findUser({ username }, false, false);
      if (!user) {
        throw new NotFoundException('USER_NOT_FOUND');
      }

      const emailHash = crypto
        .createHash('md5')
        .update(user.email.trim().toLowerCase())
        .digest('hex');
      const gravatarURL = `https://gravatar.com/avatar/${emailHash}`;

      return {
        avatarURL: gravatarURL,
      };
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err);
    }
  }

  @Get('/all')
  @Public()
  async getAllUsers() {
    try {
      const users = await this.usersService.findUsers({}, false, false, 1000);
      // Fetch all submissions for these users so we can compute aggregates
      const userIds = users.map((u) => u.id);
      const submissions = await this.prismaService.submission.findMany({
        where: {
          authorId: { in: userIds },
        },
        select: {
          authorId: true,
          points: true,
          verdict: true,
          problem: {
            select: {
              slug: true,
            },
          },
        },
      });

      // Map userId -> Map<problemSlug, maxPoints>
      const maxPointsByUser = new Map<any, Map<string, number>>();
      // Map userId -> Set<solvedProblemSlug>
      const solvedByUser = new Map<any, Set<string>>();

      submissions.forEach((sub) => {
        const uid = sub.authorId;
        const slug = sub.problem?.slug;
        if (!slug) return;
        const pts = sub.points || 0;

        let perUser = maxPointsByUser.get(uid);
        if (!perUser) {
          perUser = new Map<string, number>();
          maxPointsByUser.set(uid, perUser);
        }
        const current = perUser.get(slug) || 0;
        if (pts > current) perUser.set(slug, pts);

        if (sub.verdict === 'AC') {
          let solved = solvedByUser.get(uid);
          if (!solved) {
            solved = new Set<string>();
            solvedByUser.set(uid, solved);
          }
          solved.add(slug);
        }
      });

      const sanitizedUsers = users.map((user) => {
        const perUser = maxPointsByUser.get(user.id);
        const totalPoints = perUser
          ? Array.from(perUser.values()).reduce((s, p) => s + p, 0)
          : 0;
        const problemsSolved = solvedByUser.get(user.id)?.size || 0;

        return {
          username: user.username,
          rating: user.rating,
          totalPoints,
          problemsSolved,
          isDeleted: user.isDeleted,
        };
      });

      return sanitizedUsers;
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err);
    }
  }
}
