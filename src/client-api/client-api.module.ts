import { Module } from '@nestjs/common';
import { ContestsController } from '@/client-api/contests/contests.controller';
import { SessionsModule } from './sessions/sessions.module';
import { RouterModule } from '@nestjs/core';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ProblemsModule } from './problems/problems.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { JudgeModule } from './judge/judge.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { getRealIp } from './utils';

@Module({
  controllers: [ContestsController],
  providers: [],
  exports: [],
  imports: [
    AuthModule,
    SessionsModule,
    UsersModule,
    ProblemsModule,
    SubmissionsModule,
    JudgeModule,
    PrismaModule,
    ThrottlerModule.forRoot([
      {
        limit: 5,
        ttl: 1000,
        getTracker: getRealIp,
      },
    ]),
    RouterModule.register([
      {
        path: '/client/sessions',
        module: SessionsModule,
      },
      {
        path: '/client/users',
        module: UsersModule,
      },
      {
        path: '/client/problems',
        module: ProblemsModule,
      },
      {
        path: '/client/submissions',
        module: SubmissionsModule,
      },
      {
        path: '/client/judge',
        module: JudgeModule,
      },
    ]),
  ],
})
export class ClientAPIModule {}
