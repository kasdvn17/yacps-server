import { PrismaService } from '@/prisma/prisma.service';
import { Global, Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';

@Global()
@Injectable()
export class UsersService {
  constructor(private prismaService: PrismaService) {}

  /**
   * Find a user by given fields.
   * @param fields Fields to search for
   * @param isDeleted Whether to search for deleted users only
   * @param includeHash Whether to include the password hash in the result
   * @returns Return the user object
   */
  async findUser(
    fields: Partial<User>,
    isDeleted: boolean | undefined,
    includeHash: boolean | undefined,
  ): Promise<User | null> {
    return (
      (await this.prismaService.user.findFirst({
        where: {
          ...fields,
          isDeleted,
        },
        omit: {
          password: !includeHash,
        },
      })) || null
    );
  }

  /**
   * Find multiple users by given fields.
   * @param fields Fields to search for
   * @param isDeleted Whether to search for deleted users only
   * @param includeHash Whether to include the password hash in the result
   * @param limit Maximum number of users to return
   * @returns Array of users matching the criteria
   */
  async findUsers(
    fields: Partial<User>,
    isDeleted: boolean = false,
    includeHash: boolean = false,
    limit: number = 10,
  ): Promise<User[]> {
    const users = await this.prismaService.user.findMany({
      where: {
        ...fields,
        isDeleted,
      },
      omit: {
        password: !includeHash,
      },
      take: limit,
    });
    return users;
  }

  async countPointsAndSolvedProbs(
    user: User,
  ): Promise<{ solvedProblems: number; totalPoints: number }> {
    const data: { solvedProblems: bigint; totalPoints: number; id: string }[] =
      await this.prismaService.$queryRaw`
      SELECT
        SUM(max_points) AS "totalPoints",
        COUNT(CASE WHEN has_ac THEN 1 END) AS "solvedProblems",
        t."authorId" as id
      FROM (
        SELECT
          s."authorId",
          p.id AS "problemId",
          MAX(s.points) AS max_points,
          BOOL_OR(s.verdict = 'AC') AS has_ac
        FROM "Submission" s
        JOIN "Problem" p ON s."problemId" = p.id
        WHERE s."authorId" = ${user.id}
        GROUP BY s."authorId", p.id
      ) t
      GROUP BY t."authorId";
      `;
    const x = data[0];
    if (!x) return { solvedProblems: 0, totalPoints: 0 };
    return {
      solvedProblems: Number(x.solvedProblems),
      totalPoints: x.totalPoints,
    };
  }

  async countBatchPointsAndSolvedProbs(
    userIds: string[],
  ): Promise<{ solvedProblems: number; totalPoints: number; id: string }[]> {
    const data: { solvedProblems: bigint; totalPoints: number; id: string }[] =
      await this.prismaService.$queryRaw`
      SELECT
        SUM(max_points) AS "totalPoints",
        COUNT(CASE WHEN has_ac THEN 1 END) AS "solvedProblems",
        t."authorId" as id
      FROM (
        SELECT
          s."authorId",
          p.id AS "problemId",
          MAX(s.points) AS max_points,
          BOOL_OR(s.verdict = 'AC') AS has_ac
        FROM "Submission" s
        JOIN "Problem" p ON s."problemId" = p.id
        WHERE s."authorId" IN (${Prisma.join(userIds)})
        GROUP BY s."authorId", p.id
      ) t
      GROUP BY t."authorId";
      `;
    return data
      .filter((v) => !!v)
      .map((v) => ({
        solvedProblems: Number(v.solvedProblems),
        totalPoints: v.totalPoints,
        id: v.id,
      }));
  }

  async getSolvedAndAttemptedProblems(userId: string) {
    return await this.prismaService.$queryRaw`
      SELECT
        p.slug,
        p.name,
        MAX(s.points) AS points,
        bool_or(s.verdict = 'AC') AS solved
      FROM "Submission" s
      LEFT JOIN "Problem" p ON s."problemId" = p.id
      WHERE s."authorId" = ${userId}
      GROUP BY p.slug, p.name
    `;
  }
}
