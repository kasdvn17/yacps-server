import { Module } from '@nestjs/common';
import { ClientAPIModule } from './client-api/client-api.module';
import { JudgeAPIModule } from './judge-api/judge-api.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { RouterModule } from '@nestjs/core';

@Module({
  imports: [
    ClientAPIModule,
    JudgeAPIModule,
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
  providers: [PrismaService],
})
export class AppModule {}
