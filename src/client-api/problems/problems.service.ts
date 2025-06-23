import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ProblemsService {
  constructor(private prismaService: PrismaService) {}

  async findAllProblems(isDeleted: boolean = false) {
    return await this.prismaService.problem.findMany({
      where: {
        isDeleted,
      },
      include: {
        categories: true,
        types: true,
      },
    });
  }

  async findProblem(slug: string, isDeleted: boolean = false) {
    return await this.prismaService.problem.findFirst({
      where: {
        slug,
        isDeleted,
      },
      include: {
        categories: true,
        types: true,
        testEnvironments: true,
      },
    });
  }
}
