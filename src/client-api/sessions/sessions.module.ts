import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { UsersService } from '../users/users.service';

@Module({
  controllers: [SessionsController],
  providers: [SessionsService, UsersService],
  exports: [],
})
export class SessionsModule {}
