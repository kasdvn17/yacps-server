import { Global, Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { UsersService } from '../users/users.service';
import { BcryptService } from '../bcrypt/bcrypt.service';

@Global()
@Module({
  controllers: [SessionsController],
  providers: [SessionsService, UsersService, BcryptService],
  imports: [],
  exports: [SessionsService],
})
export class SessionsModule {}
