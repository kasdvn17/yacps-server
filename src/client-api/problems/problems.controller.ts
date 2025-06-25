import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Perms } from '../auth/auth.decorator';
import { UserPermissions } from 'constants/permissions';
import { ProblemsService } from './problems.service';
import { PermissionsService } from '../auth/permissions.service';
import { Request } from 'express';
import { CreateProblemDTO } from './problems.dto';
import { PrismaService } from '@/prisma/prisma.service';

@Controller()
export class ProblemsController {
  private readonly logger = new Logger(ProblemsController.name);

  constructor(
    private readonly problemsService: ProblemsService,
    private readonly permissionsService: PermissionsService,
    private readonly prismaService: PrismaService,
  ) {}

  @Get('/all')
  async getAllProblems() {
    const problems = await this.problemsService.findAllProblems();
    return problems.map((v) => ({
      code: v.slug,
      name: v.name,

      category: v.category.name,
      type: v.types.map((x) => x.name),
      points: v.points,
      solution: !!v.solution,
      stats: {
        submissions: v.total_subs,
        ACSubmissions: v.AC_subs,
      },
    }));
  }

  @Get('/all/deleted')
  @UseGuards(AuthGuard)
  @Perms([UserPermissions.VIEW_DELETED_PROBLEMS])
  async getAllDeletedProblems() {
    const problems = await this.problemsService.findAllProblems(true);
    return problems.map((v) => ({
      code: v.slug,
      name: v.name,

      category: v.category.name,
      type: v.types.map((x) => x.name),
      points: v.points,
      solution: !!v.solution,
      stats: {
        submissions: v.total_subs,
        ACSubmissions: v.AC_subs,
      },
    }));
  }

  @Get('/:slug')
  async getSpecificProblem(
    @Req() req: Request,
    @Param('slug') slug: string,
    @Query('deleted') isDeleted: number, // 0: false, 1: true, 2: both
  ) {
    if (
      typeof isDeleted == 'string' &&
      !isNaN(isDeleted) &&
      parseInt(isDeleted) >= 1
    ) {
      if (
        typeof req['user']?.perms != 'bigint' ||
        !this.permissionsService.hasPerms(
          req['user'].perms,
          UserPermissions.VIEW_DELETED_PROBLEMS,
        )
      )
        throw new ForbiddenException();
    }
    const problem = await this.problemsService.findProblem(slug);
    if (!problem) throw new NotFoundException('PROBLEM_NOT_FOUND');
    return {
      code: problem.slug,
      name: problem.name,
      description: problem.description,

      timeLimit: problem.testEnvironments?.timeLimit || '',
      memoryLimit: problem.testEnvironments?.memoryLimit || '',
      allowedLanguages: problem.testEnvironments?.allowedLangs || [],

      input: problem.input,
      output: problem.output,

      category: problem.category.name,
      type: problem.types.map((x) => x.name),
      points: problem.points,
      solution: problem.solution,
      author: problem.authors,
      curator: problem.curators,
      pdf: problem.pdfUuid,
      stats: {
        submissions: problem.total_subs,
        ACSubmissions: problem.AC_subs,
      },
    };
  }

  @Post('/')
  @UseGuards(AuthGuard)
  @Perms([UserPermissions.CREATE_NEW_PROBLEM])
  async createProblem(@Body() data: CreateProblemDTO) {
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
          curators: data.curators,
          authors: data.authors,
          pdfUuid: data.pdfUuid,
          categoryId: data.categoryId,
          types: {
            connect: data.types?.map((v) => ({
              id: v,
            })),
          },
          solution: data.solution,
          subStats: { create: {} },
          testEnvironments: { create: {} },
        },
      });
      return problem;
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR');
    }
  }
}
