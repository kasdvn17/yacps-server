import { Global, Module } from '@nestjs/common';
import { ProblemsController } from './problems.controller';
import { TestcasesController } from './testcases.controller';
import { ProblemsService } from './problems.service';

@Global()
@Module({
  controllers: [ProblemsController, TestcasesController],
  providers: [ProblemsService],
  imports: [],
  exports: [],
})
export class ProblemsModule {}
