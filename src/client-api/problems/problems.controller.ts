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
  Put,
  Delete,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Perms, Public } from '../auth/auth.decorator';
import { UserPermissions } from 'constants/permissions';
import { ProblemsService } from './problems.service';
import { Request } from 'express';
import { CreateProblemDTO } from './problems.dto';
import { UpdateProblemDTO } from './problems.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { LoggedInUser } from '../users/users.decorator';
import { User, TestcaseDataVisibility } from '@prisma/client';
import { PermissionsService } from '../auth/permissions.service';
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

@Controller()
export class ProblemsController {
  private readonly logger = new Logger(ProblemsController.name);

  constructor(
    private readonly problemsService: ProblemsService,
    private readonly prismaService: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  /**
   * Get all problems that the user, authenticated or not, can view.
   * @param req Request object
   * @param user Logged in user
   * @returns List of viewable problems with stats
   */
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

  /**
   * Update a problem's metadata (slug, name, description, category, types, allowedLanguages, short_circuit)
   * @param problemSlug Slug of the problem to update
   * @param data Partial update data
   * @param user Logged in user
   */
  @Put(':problemSlug')
  @UseGuards(AuthGuard)
  async updateProblem(
    @Param('problemSlug') problemSlug: string,
    @Body() data: UpdateProblemDTO,
    @LoggedInUser() user: User,
  ) {
    const problem = await this.problemsService.findViewableProblemWithSlug(
      problemSlug,
      user,
      false,
    );

    if (!problem) throw new NotFoundException('PROBLEM_NOT_FOUND');

    if (problem.isLocked) throw new ForbiddenException('PROBLEM_LOCKED');

    // Permission: authors/curators or global perms
    const canModify =
      this.permissionsService.hasPerms(
        user?.perms || 0n,
        UserPermissions.MODIFY_ALL_PROBLEMS,
      ) ||
      problem.authors.some((a) => a.id === user.id) ||
      problem.curators.some((c) => c.id === user.id);

    if (!canModify) throw new ForbiddenException('INSUFFICIENT_PERMISSIONS');

    // If updating slug, check uniqueness
    if (data.slug && data.slug !== problem.slug) {
      if (await this.problemsService.exists(data.slug))
        throw new ConflictException('PROBLEM_ALREADY_FOUND');
    }

    try {
      // Update the main problem fields and upsert testEnvironments.allowedLangs
      const updated = await this.prismaService.problem.update({
        where: { id: problem.id },
        data: {
          slug: data.slug ?? undefined,
          name: data.name ?? undefined,
          description: data.description ?? undefined,
          categoryId: data.categoryId ?? undefined,
          short_circuit: data.short_circuit ?? undefined,
          types: data.types
            ? { set: data.types.map((id) => ({ id })) }
            : undefined,
          pdfUuid: data.pdfUuid ?? undefined,
          testEnvironments: data.allowedLanguages
            ? {
                upsert: {
                  create: {
                    allowedLangs: data.allowedLanguages,
                    memoryLimit: data.memoryLimit,
                    timeLimit: data.timeLimit,
                  },
                  update: {
                    allowedLangs: data.allowedLanguages,
                    memoryLimit: data.memoryLimit,
                    timeLimit: data.timeLimit,
                  },
                },
              }
            : undefined,
        },
      });

      // After updating metadata, check object storage for tests/{slug} prefix and set hasTestData
      try {
        const bucket = process.env.STORAGE_BUCKET;
        const region = process.env.STORAGE_REGION || 'auto';
        const endpoint = process.env.STORAGE_ENDPOINT;
        const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
        const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;

        if (bucket && endpoint && accessKeyId && secretAccessKey) {
          const s3 = new S3Client({
            region,
            credentials: { accessKeyId, secretAccessKey },
            endpoint,
            forcePathStyle: false,
          });

          const slugToCheck = updated.slug || problem.slug;
          const prefix = `tests/${slugToCheck}/`;
          const listRes = await s3.send(
            new ListObjectsV2Command({
              Bucket: bucket,
              Prefix: prefix,
              MaxKeys: 1,
            }),
          );
          const hasTestData = !!(
            listRes &&
            (listRes.KeyCount || listRes.Contents?.length)
          );

          if (hasTestData !== !!updated.hasTestData) {
            await this.prismaService.problem.update({
              where: { id: problem.id },
              data: { hasTestData },
            });
          }
        }
      } catch (err) {
        this.logger.debug('Could not check object storage for test data', err);
      }

      return { success: true, data: updated };
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err.message);
    }
  }

  /**
   * Soft-delete a problem (mark isDeleted = true)
   * @param problemSlug Slug of the problem to delete
   * @param user Logged in user
   */
  @Delete(':problemSlug')
  @UseGuards(AuthGuard)
  @Perms([UserPermissions.DELETE_PROBLEM])
  async deleteProblem(
    @Param('problemSlug') problemSlug: string,
    @LoggedInUser() user: User,
  ) {
    const problem = await this.problemsService.findViewableProblemWithSlug(
      problemSlug,
      user,
      false,
    );
    if (!problem) throw new NotFoundException('PROBLEM_NOT_FOUND');

    if (problem.isLocked) throw new ForbiddenException('PROBLEM_LOCKED');

    try {
      await this.prismaService.problem.update({
        where: { id: problem.id },
        data: { isDeleted: true },
      });
      return { success: true };
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err.message);
    }
  }

  /**
   * Lock/unlock a problem
   * @param problemSlug Slug of the problem to delete
   * @param user Logged in user
   */
  @Post('/:problemSlug/lock')
  @UseGuards(AuthGuard)
  @Perms([UserPermissions.LOCK_PROBLEM])
  async lockProblem(
    @Param('problemSlug') problemSlug: string,
    @LoggedInUser() user: User,
  ) {
    const problem = await this.problemsService.findViewableProblemWithSlug(
      problemSlug,
      user,
      false,
    );
    if (!problem) throw new NotFoundException('PROBLEM_NOT_FOUND');

    try {
      await this.prismaService.problem.update({
        where: { id: problem.id },
        data: { isLocked: !problem.isLocked },
      });
      return { isLocked: !problem.isLocked };
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err.message);
    }
  }

  /**
   * Get all problems with their status for the logged in user.
   * @param req Request object
   * @param user Logged in user
   * @returns List of problems with their status
   */
  @Get('/all/status')
  @UseGuards(AuthGuard)
  async getAllProblemsStatus(@Req() req: Request, @LoggedInUser() user: User) {
    return await this.problemsService.getProblemsStatusList(
      this.problemsService.hasViewAllProbsPerms(user),
      user.id,
    );
  }

  /**
   * Get a specific problem by its slug.
   * @param req Request object
   * @param slug Slug of the problem to fetch
   * @param user Logged in user
   * @returns Details of the specific problem
   */
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

      short_circuit: problem.short_circuit,

      problemSource: problem.problemSource,
      author: problem.authors.map((v) => v.username),
      curator: problem.curators.map((v) => v.username),
      testcaseDataVisibility: problem.testcaseDataVisibility,
      ...(problem.isDeleted && { isDeleted: true }),
      ...(problem.isLocked && { isLocked: true }),
      // Include stored archives (uploaded test zips, init.yml, checkers) so frontend
      // can present persistent download links for the uploaded files.
      archives: (problem as any).archives
        ? (problem as any).archives.map((a: any) => ({
            id: a.id,
            filename: a.filename,
            url: a.url,
            hasInit: a.hasInit,
          }))
        : [],
    };
    return res;
  }

  /**
   * Create a problem
   * @param req Request object
   * @param user Logged in user
   * @param data Data for the new problem
   * @returns Details of the specific problem
   */
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
          short_circuit: data.short_circuit || false,
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
          testEnvironments: {
            create: {
              allowedLangs: data.allowedLanguages || [],
              timeLimit: data.timeLimit,
              memoryLimit: data.memoryLimit,
            },
          },
        },
      });
      return problem;
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err.message);
    }
  }

  /**
   * Update the testcase visibility for a problem.
   * @param problemSlug Slug of the problem to update
   * @param data Data containing the new visibility setting
   * @param user Logged in user
   * @returns Updated testcase visibility setting
   */
  @Put(':problemSlug/testcase-visibility')
  @UseGuards(AuthGuard)
  async updateTestcaseVisibility(
    @Param('problemSlug') problemSlug: string,
    @Body() data: { visibility: TestcaseDataVisibility },
    @LoggedInUser() user: User,
  ) {
    // Get the problem with permission info
    const problem = await this.problemsService.findViewableProblemWithSlug(
      problemSlug,
      user,
      false,
    );

    if (!problem) {
      throw new NotFoundException('PROBLEM_NOT_FOUND');
    }

    if (problem.isLocked)
      throw new ForbiddenException('PROBLEM_LOCKED', {
        description:
          'Modifications to this problem are restricted. Please contact an administrator for further assistance.',
      });

    // Check if user can edit this problem's test cases
    if (!this.canEditProblemTestcases(problem, user)) {
      throw new ForbiddenException('INSUFFICIENT_PERMISSIONS');
    }

    // Update the testcase visibility
    const updatedProblem = await this.prismaService.problem.update({
      where: { id: problem.id },
      data: { testcaseDataVisibility: data.visibility },
    });

    return {
      success: true,
      data: {
        testcaseDataVisibility: updatedProblem.testcaseDataVisibility,
      },
    };
  }

  /**
   * Check if user can edit problem testcases
   * Based on DMOJ's permission model: authors, curators, or EDIT_PROBLEM_TESTS permission
   * @param problem The problem object containing authors, curators, and testers
   * @param user The user object to check permissions for
   * @returns The boolean indicating if the user can edit the problem's test cases
   */
  private canEditProblemTestcases(
    problem: {
      authors: { id: string }[];
      curators: { id: string }[];
    },
    user: User,
  ): boolean {
    // Check if user has global permission
    if (
      user.perms &&
      this.permissionsService.hasPerms(
        user.perms,
        UserPermissions.EDIT_PROBLEM_TESTS,
      )
    ) {
      return true;
    }

    // Check if user is author, curator, or tester
    if (problem.authors.some((author) => author.id === user.id)) return true;
    if (problem.curators.some((curator) => curator.id === user.id)) return true;

    return false;
  }
}
