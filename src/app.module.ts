import { Module } from '@nestjs/common';
import { ClientAPIModule } from './client-api/client-api.module';
import { JudgeAPIModule } from './judge-api/judge-api.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [
    ClientAPIModule,
    JudgeAPIModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [],
  providers: [PrismaService],
})
export class AppModule {}
