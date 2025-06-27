import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Argon2Service } from '../argon2/argon2.service';
import { TurnstileModule } from '../turnstile/turnstile.module';

@Module({
  imports: [TurnstileModule],
  controllers: [UsersController],
  providers: [UsersService, Argon2Service],
  exports: [UsersService],
})
export class UsersModule {}
