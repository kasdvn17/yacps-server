import { Module } from '@nestjs/common';
import { TypesController } from './types.controller.js';
import { TypesService } from './types.service.js';

@Module({
  controllers: [TypesController],
  providers: [TypesService],
})
export class TypesModule {}
