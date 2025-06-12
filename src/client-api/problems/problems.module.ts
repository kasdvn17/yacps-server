import { Global, Module } from '@nestjs/common';
import { ProblemsController } from './problems.controller';

@Global()
@Module({
  controllers: [ProblemsController],
  providers: [],
  imports: [],
  exports: [],
})
export class ProblemsModule {}
