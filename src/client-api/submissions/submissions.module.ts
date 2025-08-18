import { Module } from '@nestjs/common';
import { SubmissionsController } from './submissions.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { JudgeAPIModule } from '@/judge-api/judge-api.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [PrismaModule, JudgeAPIModule, EventEmitterModule],
  controllers: [SubmissionsController],
  providers: [],
})
export class SubmissionsModule {}
