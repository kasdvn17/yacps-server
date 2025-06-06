import { Module } from '@nestjs/common';
import { SessionsController } from './sessions/sessions.controller';
import { Permissions } from '@/helpers/permissions/permissions.service';

@Module({
  controllers: [SessionsController],
  providers: [Permissions],
  exports: [],
})
export class ClientAPIModule {}
