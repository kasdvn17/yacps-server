import { Module } from '@nestjs/common';
import { SessionsController } from './sessions/sessions.controller';
import { Permissions } from '@/helpers/permissions/permissions';

@Module({
  controllers: [SessionsController],
  providers: [Permissions],
  exports: [],
})
export class ClientAPIModule {}
