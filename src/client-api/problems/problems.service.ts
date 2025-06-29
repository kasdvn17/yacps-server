import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ProblemsService {
  constructor(private prismaService: PrismaService) {}

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
    });
  }

  async findAllSystemProblems() {
    return await this.prismaService.problem.findMany({
      include: {
        category: true,
        types: true,
      },
    });
  }

  async findProblem(slug: string, isDeleted: boolean | undefined) {
    return await this.prismaService.problem.findFirst({
      where: {
        slug,
        isDeleted,
      },
      include: {
        category: true,
        types: true,
        testEnvironments: true,
      },
    });
  }

  async exists(slug: string) {
    const prob = await this.prismaService.problem.findFirst({
      where: {
        slug,
      },
    });
    return !!prob;
  }
}
