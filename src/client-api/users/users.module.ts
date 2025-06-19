import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Argon2Service } from '../argon2/argon2.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, Argon2Service],
  exports: [UsersService],
})
export class UsersModule {}
