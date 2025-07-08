import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

@Injectable()
export class ProblemsService {
  constructor(private prismaService: PrismaService) {}
  private logger = new Logger(ProblemsService.name);

  async findAllPublicProblems() {
    return await this.prismaService.problem.findMany({
      where: {
        isPublic: true,
        isDeleted: false,
      },
      include: {
        category: true,
        types: true,
      },
      orderBy: {
        id: 'desc',
      },
    });
  }

  async findAllSystemProblems() {
    return await this.prismaService.problem.findMany({
      include: {
        category: true,
        types: true,
      },
      orderBy: {
        id: 'desc',
      },
    });
  }

  async findProblem(slug: string, isDeleted: boolean | undefined) {
    const problem = await this.prismaService.problem.findUnique({
      where: {
        slug,
      },
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
        curators: {
          select: {
            username: true,
          },
        },
        authors: {
          select: {
            username: true,
          },
        },
      },
    });
    if (isDeleted == false && problem?.isDeleted) return null;
    return problem;
  }

  async findProblemWithId(id: number, isDeleted: boolean | undefined) {
    if (!Number.isInteger(id)) throw new BadRequestException('ID_NOT_INTEGER');
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

  async exists(slug: string) {
    const prob = await this.prismaService.problem.findUnique({
      where: {
        slug,
      },
    });
    return !!prob;
  }

  async getBasicSubStats(id: number) {
    if (!Number.isInteger(id)) throw new BadRequestException('ID_NOT_INTEGER');
    try {
      const result: { id: number; total_subs: number; ac_subs: number }[] =
        await this.prismaService.$queryRaw`
      SELECT
          COUNT(*)::int AS total_subs,
          SUM(CASE WHEN verdict = 'AC' THEN 1 ELSE 0 END)::int AS ac_subs
      FROM "Submission"
      WHERE "problemId" = ${id};
    `;
      return {
        submissions: result[0]?.total_subs || 0,
        ACSubmissions: result[0]?.ac_subs || 0,
      };
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException('UNKNOWN_ERROR', err);
    }
  }

  async getProblemsStatusList(view_all_probs: boolean = false, userId: string) {
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
}
