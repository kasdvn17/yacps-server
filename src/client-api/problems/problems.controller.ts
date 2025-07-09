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
  @Public()
  @UseGuards(AuthGuard)
  async getAllProblems(@Req() req: Request) {
    let hasViewAllProbs = false;
    if (
      req['user'] &&
      req['user'].perms &&
      this.permissionsService.hasPerms(
        req['user'].perms,
        UserPermissions.VIEW_ALL_PROBLEMS,
      )
    )
      hasViewAllProbs = true;

    const userId = req['user']?.id;

    const problems = await this.prismaService.problem.findMany({
      where: hasViewAllProbs
        ? {}
        : userId
          ? {
              OR: [
                { isPublic: true, isDeleted: false },
                { authors: { some: { id: userId } } },
                { curators: { some: { id: userId } } },
                { testers: { some: { id: userId } } },
              ],
            }
          : { isPublic: true, isDeleted: false },
      include: {
        category: true,
        types: true,
      },
      orderBy: {
        id: 'desc',
      },
    });

    return await Promise.all(
      problems.map(async (v) => {
        const stats = await this.problemsService.getBasicSubStats(v.id);
        const res = {
          code: v.slug,
          name: v.name,

          category: v.category.name,
          type: v.types.map((x) => x.name),
          points: v.points,
          solution: !!v.solution,

          stats,
        };
        if (v.isDeleted) res['isDeleted'] = true;
        return res;
      }),
    );
  }

  @Get('/all/status')
  @UseGuards(AuthGuard)
  async getAllProblemsStatus(@Req() req: Request) {
    let hasViewAllProbs = false;
    if (
      req['user'].perms &&
      this.permissionsService.hasPerms(
        req['user'].perms,
        UserPermissions.VIEW_ALL_PROBLEMS,
      )
    )
      hasViewAllProbs = true;
    return await this.problemsService.getProblemsStatusList(
      hasViewAllProbs,
      req['user'].id,
    );
  }

  @Get('/details/:slug')
  @Public()
  @UseGuards(AuthGuard)
  async getSpecificProblem(@Req() req: Request, @Param('slug') slug: string) {
    let hasViewAllProbs = false;
    if (
      req['user'] &&
      req['user'].perms &&
      this.permissionsService.hasPerms(
        req['user'].perms,
        UserPermissions.VIEW_ALL_PROBLEMS,
      )
    )
      hasViewAllProbs = true;

    const userId = req['user']?.id;
    const problem = await this.prismaService.problem.findUnique({
      where: hasViewAllProbs
        ? { slug }
        : userId
          ? {
              OR: [
                { isPublic: true, isDeleted: false },
                { authors: { some: { id: userId } } },
                { curators: { some: { id: userId } } },
                { testers: { some: { id: userId } } },
              ],
              slug,
            }
          : { isPublic: true, isDeleted: false, slug },
      include: {
        category: true,
        types: true,
        testEnvironments: true,
        authors: true,
        curators: true,
      },
    });
    if (!problem) throw new NotFoundException('PROBLEM_NOT_FOUND');
    const res = {
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
    };
    if (problem.isDeleted) res['isDeleted'] = true;
    return res;
  }

  @Post('/new')
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
          curators: {
            connect: data.curators?.map((v) => ({
              id: v,
            })),
          },
          authors: {
            connect: data.authors?.map((v) => ({
              id: v,
            })),
          },
          pdfUuid: data.pdfUuid,
          categoryId: data.categoryId,
          types: {
            connect: data.types?.map((v) => ({
              id: v,
            })),
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
