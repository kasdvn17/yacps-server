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
import { Category, Problem, Type } from '@prisma/client';

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
    let problems: (Problem & { category: Category; types: Type[] })[];
    if (hasViewAllProbs)
      problems = await this.problemsService.findAllSystemProblems();
    else problems = await this.problemsService.findAllPublicProblems();

    return await Promise.all(
      problems.map(async (v) => {
        const stats = await this.problemsService.getBasicSubStats(v.id);
        return {
          code: v.slug,
          name: v.name,

          category: v.category.name,
          type: v.types.map((x) => x.name),
          points: v.points,
          solution: !!v.solution,

          stats,

          isDeleted: v.isDeleted,
        };
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
    const showHidden = hasViewAllProbs ? true : false;

    const result = await this.prismaService.$queryRaw`
        SELECT
          p.slug,
          p."isLocked",
          p."isPublic",
          bool_or(s.verdict = 'AC') AS solved,
          count(s.*) > 0 AS attempted
        FROM "Problem" p
        LEFT JOIN "Submission" s ON s."problemSlug" = p.slug AND s."authorId" = ${req['user'].id}
        WHERE (${showHidden} OR (p."isPublic" = true AND p."isDeleted" = false))
        GROUP BY p.slug, p."isLocked", p."isPublic";
      `;
    return result;
  }

  @Get('/:slug')
  @Public()
  @UseGuards(AuthGuard)
  async getSpecificProblem(@Req() req: Request, @Param('slug') slug: string) {
    const problem = await this.problemsService.findProblem(slug, undefined);
    if (!problem) throw new NotFoundException('PROBLEM_NOT_FOUND');
    if (problem.isDeleted || problem.isPublic == false) {
      // in the future: organizations :v
      if (
        !req['user'] ||
        !req['user'].perms ||
        !this.permissionsService.hasPerms(
          req['user'].perms,
          UserPermissions.VIEW_ALL_PROBLEMS,
        )
      )
        throw new ForbiddenException('PROBLEM_UNAVAILABLE');
    }
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

      isDeleted: problem.isDeleted,
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
