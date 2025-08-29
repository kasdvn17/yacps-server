import { Controller, Get } from '@nestjs/common';
import { CategoriesService } from './categories.service';

@Controller()
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get('/names')
  async getCategoriesName() {
    return await this.categoriesService.getCategoriesName();
  }

  @Get('/all')
  async getAllCategories() {
    const cats = await this.categoriesService.findCategories();
    return cats.map((c) => ({ id: c.id, name: c.name }));
  }
}
