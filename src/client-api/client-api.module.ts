import { Module } from '@nestjs/common';
import { PermissionsService } from '@/helpers/permissions/permissions.service';
import { SubmissionsController } from '@/client-api/submissions/submissions.controller';
import { ProblemsController } from '@/client-api/problems/problems.controller';
import { ContestsController } from '@/client-api/contests/contests.controller';
import { SessionsModule } from './sessions/sessions.module';
import { RouterModule } from '@nestjs/core';
import { UsersModule } from './users/users.module';

@Module({
  controllers: [SubmissionsController, ProblemsController, ContestsController],
  providers: [PermissionsService],
  exports: [],
  imports: [
    SessionsModule,
    UsersModule,
    RouterModule.register([
      {
        path: '/client/sessions',
        module: SessionsModule,
      },
      {
        path: '/client/users',
        module: UsersModule,
      },
    ]),
  ],
})
export class ClientAPIModule {}
