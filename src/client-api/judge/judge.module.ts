import { Module } from '@nestjs/common';
import { JudgeController } from './judge.controller';
import { JudgeAPIModule } from '@/judge-api/judge-api.module';

@Module({
  controllers: [JudgeController],
  imports: [JudgeAPIModule],
})
export class JudgeModule {}
