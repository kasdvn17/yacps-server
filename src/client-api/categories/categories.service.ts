import { PrismaService } from '@/prisma/prisma.service';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Category } from '@prisma/client';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);
  constructor(private readonly prismaService: PrismaService) {}

  async getCategoriesName(): Promise<string[]> {
    try {
      return (
        await this.prismaService.category.findMany({
          select: {
            name: true,
          },
        })
      ).map((v) => v.name);
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException(err);
    }
  }

  async findCategories(): Promise<Category[]> {
    try {
      return await this.prismaService.category.findMany();
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException(err);
    }
  }

  async exists(name: string): Promise<boolean> {
    const cat = await this.prismaService.category.findUnique({
      where: {
        name,
      },
    });

    return !!cat;
  }
}
