import { Module } from '@nestjs/common';
import { SubmissionsController } from '@/client-api/submissions/submissions.controller';
import { ContestsController } from '@/client-api/contests/contests.controller';
import { SessionsModule } from './sessions/sessions.module';
import { RouterModule } from '@nestjs/core';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ProblemsModule } from './problems/problems.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { getRealIp } from './utils';

@Module({
  controllers: [SubmissionsController, ContestsController],
  providers: [],
  exports: [],
  imports: [
    AuthModule,
    SessionsModule,
    UsersModule,
    ProblemsModule,
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
    ]),
  ],
})
export class ClientAPIModule {}
