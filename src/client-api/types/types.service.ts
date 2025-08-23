import { PrismaService } from '@/prisma/prisma.service';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Type } from '@prisma/client';

@Injectable()
export class TypesService {
  private readonly logger = new Logger(TypesService.name);
  constructor(private readonly prismaService: PrismaService) {}

  async getTypesName(): Promise<string[]> {
    try {
      return (
        await this.prismaService.type.findMany({
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

  async findTypes(): Promise<Type[]> {
    try {
      return await this.prismaService.type.findMany();
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException(err);
    }
  }
}
