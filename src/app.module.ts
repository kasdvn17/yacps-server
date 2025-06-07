import { Module } from '@nestjs/common';
import { ClientAPIModule } from './client-api/client-api.module';
import { JudgeAPIModule } from './judge-api/judge-api.module';
import { ConfigModule } from '@nestjs/config';
import { RouterModule } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ClientAPIModule,
    JudgeAPIModule,
    PrismaModule,
    RouterModule.register([
      {
        path: '/client',
        module: ClientAPIModule,
      },
      {
        path: '/judge',
        module: JudgeAPIModule,
      },
    ]),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
