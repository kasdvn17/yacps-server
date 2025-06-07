import { Module } from '@nestjs/common';
import { ClientAPIModule } from './client-api/client-api.module';
import { JudgeAPIModule } from './judge-api/judge-api.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { RouterModule } from '@nestjs/core';
import { SubmissionsController } from './submissions/submissions.controller';

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
  controllers: [SubmissionsController],
  providers: [PrismaService],
})
export class AppModule {}
