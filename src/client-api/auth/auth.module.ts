import { Global, Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';

@Global()
@Module({
  controllers: [],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class AuthModule {}
