import { Module } from '@nestjs/common';
import { SessionsController } from './sessions/sessions.controller';
import { PermissionsService } from '@/helpers/permissions/permissions.service';
import { SubmissionsController } from '@/client-api/submissions/submissions.controller';
import { UsersController } from '@/client-api/users/users.controller';
import { ProblemsController } from '@/client-api/problems/problems.controller';
import { ContestsController } from '@/client-api/contests/contests.controller';
import { SessionsService } from './sessions/sessions.service';

@Module({
  controllers: [
    SessionsController,
    SubmissionsController,
    UsersController,
    ProblemsController,
    ContestsController,
  ],
  providers: [PermissionsService, SessionsService],
  exports: [],
})
export class ClientAPIModule {}
