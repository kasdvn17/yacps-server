import { Global, Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { UsersService } from '../users/users.service';
import { Argon2Service } from '../argon2/argon2.service';
import { TurnstileModule } from '../turnstile/turnstile.module';

@Global()
@Module({
  controllers: [SessionsController],
  providers: [SessionsService, UsersService, Argon2Service],
  imports: [TurnstileModule],
  exports: [SessionsService],
})
export class SessionsModule {}
