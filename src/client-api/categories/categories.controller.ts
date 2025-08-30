import {
  Body,
  ConflictException,
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { AuthGuard } from '../auth/auth.guard';
import { Perms } from '../auth/auth.decorator';
import { UserPermissions } from 'constants/permissions';
import { CreateCategoryDTO } from './categories.dto';
import { PrismaService } from '@/prisma/prisma.service';

@Controller()
export class CategoriesController {
  private readonly logger = new Logger(CategoriesController.name);
  constructor(
    private categoriesService: CategoriesService,
    private prismaService: PrismaService,
  ) {}

  @Get('/names')
  async getCategoriesName() {
    return await this.categoriesService.getCategoriesName();
  }

  @Get('/all')
  async getAllCategories() {
    const cats = await this.categoriesService.findCategories();
    return cats.map((c) => ({ id: c.id, name: c.name }));
  }

  @Post('/new')
  @UseGuards(AuthGuard)
  @Perms([UserPermissions.CREATE_NEW_PROBLEM])
  async createCategory(@Body() data: CreateCategoryDTO) {
    if (await this.categoriesService.exists(data.name)) {
      throw new ConflictException('Category already exists');
    }

    try {
      const cat = this.prismaService.category.create({
        data: {
          name: data.name,
        },
      });

      return cat;
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException(err);
    }
  }
}
