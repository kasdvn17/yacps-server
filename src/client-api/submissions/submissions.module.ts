import { Module } from '@nestjs/common';
import { SubmissionsController } from './submissions.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { JudgeAPIModule } from '@/judge-api/judge-api.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ProblemsService } from '../problems/problems.service';
import { SubmissionsService } from './submissions.service';
import { UsersService } from '../users/users.service';

@Module({
  imports: [PrismaModule, JudgeAPIModule, EventEmitterModule],
  controllers: [SubmissionsController],
  providers: [ProblemsService, SubmissionsService, UsersService],
})
export class SubmissionsModule {}
