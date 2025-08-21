import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { UserPermissions } from 'constants/permissions';
import { PermissionsService } from '../auth/permissions.service';

@Injectable()
export class ProblemsService {
  constructor(
    private prismaService: PrismaService,
    private permissionsService: PermissionsService,
  ) {}
  private logger = new Logger(ProblemsService.name);

  /**
   * Get a list of problems that the user can view.
   * @param user The user querying the problems.
   * @returns The list of viewable problems from the user
   */
  async findViewableProblems(user?: User) {
    const userId = user?.id;

    return await this.prismaService.problem.findMany({
      where: this.hasViewAllProbsPerms(user)
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
        category: {
          select: {
            name: true,
          },
        },
        types: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        id: 'desc',
      },
    });
  }

  /**
   * Get a problem by slug that the user can view.
   * @param slug The slug of the problem to find.
   * @param user The user querying the problem.
   * @returns The viewable problem with the given slug.
   */
  async findViewableProblemWithSlug(slug: string, user?: User) {
    const userId = user?.id;
    return await this.prismaService.problem.findFirst({
      where: this.hasViewAllProbsPerms(user)
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
        category: {
          select: {
            name: true,
          },
        },
        types: {
          select: {
            name: true,
          },
        },
        testEnvironments: true,
        authors: {
          select: {
            id: true,
            username: true,
            rating: true,
          },
        },
        curators: {
          select: {
            id: true,
            username: true,
            rating: true,
          },
        },
        testers: {
          select: {
            id: true,
            username: true,
            rating: true,
          },
        },
      },
    });
  }

  /**
   * Get a problem by ID
   * @param id The ID of the problem to find.
   * @param isDeleted Whether to include deleted problems.
   * @returns The viewable problem with the given ID.
   */
  async findProblemWithId(id: number, isDeleted: boolean | undefined) {
    if (!Number.isInteger(id)) throw new BadRequestException('INVALID_ID');
    const problem = await this.prismaService.problem.findUnique({
      where: {
        id,
      },
      include: {
        category: true,
        types: true,
        testEnvironments: true,
      },
    });
    if (!isDeleted && problem?.isDeleted) return null;
    return problem;
  }

  /**
   * Check if a problem exists
   * @param slug The slug of the problem to check.
   * @returns The boolean indicating the existence.
   */
  async exists(slug: string) {
    const prob = await this.prismaService.problem.findUnique({
      where: {
        slug,
      },
    });
    return !!prob;
  }

  /**
   * Get the basic submission statistics for a batch of problems.
   * @param ids The IDs of the problems to get statistics for.
   * @returns An array of objects containing the problem ID, total submissions, and accepted submissions.
   */
  async getBatchBasicSubStats(ids: number[]) {
    if (ids.length == 0) return [];
    if (ids.some((v) => !Number.isInteger(v)))
      throw new BadRequestException('INVALID_ID'); // prevent xss injection too
    try {
      // using query raw to optimize performance
      const result: {
        id?: number;
        submissions: number;
        ACSubmissions: number;
      }[] = await this.prismaService.$queryRaw`
      SELECT
          COUNT(*)::int AS submissions,
          SUM(CASE WHEN verdict = 'AC' THEN 1 ELSE 0 END)::int AS "ACSubmissions",
          "problemId" AS id
      FROM "Submission"
      WHERE "problemId" IN (${Prisma.join(ids)})
      GROUP BY "problemId";
    `;
      return result;
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err);
    }
  }

  /**
   * Get the basic submission statistics for a single problem.
   * @param id The ID of the problem to get statistics for.
   * @returns An object containing the total submissions and accepted submissions.
   */
  async getBasicSubStats(id: number) {
    if (!Number.isInteger(id)) throw new BadRequestException('INVALID_ID'); // prevent xss injection too
    try {
      // using query raw to optimize performance
      const result: {
        submissions: number;
        ACSubmissions: number;
      }[] = await this.prismaService.$queryRaw`
      SELECT
          COUNT(*)::int AS submissions,
          SUM(CASE WHEN verdict = 'AC' THEN 1 ELSE 0 END)::int AS "ACSubmissions"
      FROM "Submission"
      WHERE "problemId" = ${id};
    `;
      return (
        result[0] || {
          submissions: 0,
          ACSubmissions: 0,
        }
      );
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err);
    }
  }

  /**
   * Get the status of problems for a user.
   * @param view_all_probs Whether to view all problems or only those the user can see.
   * @param userId The ID of the user to get the status for.
   * @returns A list of problems with their status (solved, attempted).
   */
  async getProblemsStatusList(view_all_probs: boolean = false, userId: string) {
    // using query raw to optimize performance
    return await this.prismaService.$queryRaw`
    WITH user_visible_problems AS (
    SELECT "A" FROM "_AuthorToProblem" WHERE "B" = ${userId}
    UNION
    SELECT "A" FROM "_CuratorToProblem" WHERE "B" = ${userId}
    UNION
    SELECT "A" FROM "_TesterToProblem" WHERE "B" = ${userId}
  )

  SELECT
    p.slug,
    p."isLocked",
    p."isPublic",
    bool_or(s.verdict = 'AC') AS solved,
    count(s.*) > 0 AS attempted
  FROM "Problem" p
  LEFT JOIN "Submission" s ON s."problemId" = p.id AND s."authorId" = ${userId}
  WHERE (
    ${view_all_probs} OR
    (p."isPublic" = true AND p."isDeleted" = false) OR
    (p.id IN (SELECT "A" FROM user_visible_problems))
  )
  GROUP BY p.slug, p."isLocked", p."isPublic";
  `;
  }

  /**
   * Check if the user has permission to view all problems.
   * @param user The user to check permissions for.
   * @returns A boolean indicating whether the user has permission to view all problems.
   */
  hasViewAllProbsPerms(user?: User) {
    let hasViewAllProbs = false;
    if (
      user &&
      user.perms &&
      this.permissionsService.hasPerms(
        user.perms,
        UserPermissions.VIEW_ALL_PROBLEMS,
      )
    )
      hasViewAllProbs = true;
    return hasViewAllProbs;
  }

  /**
   * Check if the user can view a specific problem.
   * @param user The user to check permissions for.
   * @param problem The problem to check.
   * @returns A boolean indicating whether the user can view the problem.
   */
  viewableProblem(
    user?: User,
    problem?: {
      isPublic: boolean;
      isDeleted: boolean;
      authors: { id: string }[];
      curators: { id: string }[];
      testers: { id: string }[];
    },
  ) {
    if (!problem) return false;
    if (this.hasViewAllProbsPerms(user)) return true;

    if (user) {
      if (problem.isPublic && !problem.isDeleted) return true;
      if (problem.authors.some((a) => a.id === user.id)) return true;
      if (problem.curators.some((c) => c.id === user.id)) return true;
      if (problem.testers.some((t) => t.id === user.id)) return true;
    } else {
      if (problem.isPublic && !problem.isDeleted) return true;
    }
    return false;
  }

  /**
   * Check if the user has solved a problem.
   * @param user The user to check.
   * @param problemId The ID of the problem to check.
   * @returns A boolean indicating whether the user has solved the problem.
   */
  async hasACProb(user?: User, problemId?: number): Promise<boolean> {
    if (!user || !problemId) return false;
    return await this.prismaService.submission
      .count({
        where: {
          authorId: user.id,
          problemId,
          verdict: 'AC',
        },
      })
      .then((count) => count > 0);
  }
}
