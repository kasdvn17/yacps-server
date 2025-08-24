import { Controller, Get } from '@nestjs/common';
import { TypesService } from './types.service';

@Controller()
export class TypesController {
  constructor(private typesService: TypesService) {}

  @Get('/names')
  async getTypesName() {
    return await this.typesService.getTypesName();
  }

  @Get('/all')
  async getAllTypes() {
    const types = await this.typesService.findTypes();
    return types.map((t) => ({ id: t.id, name: t.name }));
  }
}
