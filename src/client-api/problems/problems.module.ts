import { Global, Module } from '@nestjs/common';
import { ProblemsController } from './problems.controller';
import { ProblemsService } from './problems.service';

@Global()
@Module({
  controllers: [ProblemsController],
  providers: [ProblemsService],
  imports: [],
  exports: [],
})
export class ProblemsModule {}
