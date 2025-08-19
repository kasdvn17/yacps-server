import {
  Body,
  ConflictException,
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Perms, Public } from '../auth/auth.decorator';
import { UserPermissions } from 'constants/permissions';
import { ProblemsService } from './problems.service';
import { Request } from 'express';
import { CreateProblemDTO } from './problems.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggedInUser } from '../users/users.decorator';
import { User } from '@prisma/client';

@Controller()
export class ProblemsController {
  private readonly logger = new Logger(ProblemsController.name);

  constructor(
    private readonly problemsService: ProblemsService,
    private readonly prismaService: PrismaService,
  ) {}

  @Get('/all')
  @Public()
  @UseGuards(AuthGuard)
  async getAllProblems(@Req() req: Request, @LoggedInUser() user: User) {
    const problems = await this.problemsService.findViewableProblems(user);

    const subStats = await this.problemsService.getBatchBasicSubStats(
      problems.map((v) => v.id),
    );

    return problems.map((v) => {
      const stats = subStats.find((x) => x.id === v.id) ?? {
        submissions: 0,
        ACSubmissions: 0,
      };
      if (stats) delete stats.id;

      const res = {
        code: v.slug,
        name: v.name,

        category: v.category.name,
        type: v.types.map((x) => x.name),
        points: v.points,
        solution: !!v.solution,

        stats,
        ...(v.isDeleted && { isDeleted: true }),
      };
      return res;
    });
  }

  @Get('/all/status')
  @UseGuards(AuthGuard)
  async getAllProblemsStatus(@Req() req: Request, @LoggedInUser() user: User) {
    return await this.problemsService.getProblemsStatusList(
      this.problemsService.hasViewAllProbsPerms(user),
      user.id,
    );
  }

  @Get('/details/:slug')
  @Public()
  @UseGuards(AuthGuard)
  async getSpecificProblem(
    @Req() req: Request,
    @Param('slug') slug: string,
    @LoggedInUser() user: User,
  ) {
    const problem = await this.problemsService.findViewableProblemWithSlug(
      slug,
      user,
    );
    if (!problem) throw new NotFoundException('PROBLEM_NOT_FOUND');
    const res = {
      id: problem.id,
      code: problem.slug,
      name: problem.name,
      description: problem.description,
      pdf: problem.pdfUuid,

      timeLimit: problem.testEnvironments?.timeLimit || '',
      memoryLimit: problem.testEnvironments?.memoryLimit || '',
      allowedLanguages: problem.testEnvironments?.allowedLangs || [],

      input: problem.input,
      output: problem.output,

      category: problem.category.name,
      type: problem.types.map((x) => x.name),

      points: problem.points,
      solution: problem.solution,

      problemSource: problem.problemSource,
      author: problem.authors.map((v) => v.username),
      curator: problem.curators.map((v) => v.username),
      ...(problem.isDeleted && { isDeleted: true }),
    };
    return res;
  }

  @Post('/new')
  @UseGuards(AuthGuard)
  @Perms([UserPermissions.CREATE_NEW_PROBLEM])
  async createProblem(
    @Body() data: CreateProblemDTO,
    @Req() req: Request,
    @LoggedInUser() user: User,
  ) {
    if (await this.problemsService.exists(data.slug))
      throw new ConflictException('PROBLEM_ALREADY_FOUND');

    try {
      const problem = await this.prismaService.problem.create({
        data: {
          slug: data.slug,
          name: data.name,
          description: data.description,
          points: data.points,
          input: data.input,
          output: data.output,
          curators: {
            connect: data.curators?.map((v) => ({
              id: v,
            })) || [{ id: user.id }],
          },
          authors: {
            connect:
              data.authors?.map((v) => ({
                id: v,
              })) || [],
          },
          pdfUuid: data.pdfUuid,
          categoryId: data.categoryId,
          types: {
            connect:
              data.types?.map((v) => ({
                id: v,
              })) || [],
          },
          solution: data.solution,
          testEnvironments: { create: {} },
        },
      });
      return problem;
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err);
    }
  }
}
