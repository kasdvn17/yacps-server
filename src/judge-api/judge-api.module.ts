import { PrismaModule } from '@/prisma/prisma.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { MessageGateway } from './message/message.gateway';
import { SubmissionQueueService } from './submission-queue/submission-queue.service';
import { DMOJBridgeService } from './dmoj-bridge/dmoj-bridge.service';
import { JudgeManagerService } from './judge-manager/judge-manager.service';

@Module({
  imports: [
    PrismaModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    JwtModule.register({
      secret: process.env.JWT_JUDGE_TOKEN,
    }),
  ],
  controllers: [],
  providers: [
    MessageGateway,
    SubmissionQueueService,
    DMOJBridgeService,
    JudgeManagerService,
  ],
  exports: [SubmissionQueueService, DMOJBridgeService, JudgeManagerService],
})
export class JudgeAPIModule {}
