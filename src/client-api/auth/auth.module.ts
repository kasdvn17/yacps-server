import { Global, Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { JwtModule } from '@nestjs/jwt';
import { Config } from 'config';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_CLIENT_TOKEN,
      signOptions: { expiresIn: Config.SESSION_EXPIRES_MS / 1000 },
    }),
  ],
  controllers: [],
  providers: [PermissionsService],
  exports: [
    PermissionsService,
    JwtModule.register({
      secret: process.env.JWT_CLIENT_TOKEN,
      signOptions: { expiresIn: Config.SESSION_EXPIRES_MS / 1000 },
    }),
  ],
})
export class AuthModule {}
