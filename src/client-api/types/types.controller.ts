import { Body, Controller, Get, Post } from '@nestjs/common';
import { TypesService } from './types.service';
import { CreateTypesDTO } from './types.dto';

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

  @Post('/new')
  async createTypes(@Body() data: CreateTypesDTO) {
    const createdTypes = await this.typesService.create(data.names);
    return createdTypes.map((t) => ({ id: t.id, name: t.name }));
  }
}
