import { PrismaModule } from '@/prisma/prisma.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MessageGateway } from './message/message.gateway';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_JUDGE_TOKEN,
    }),
  ],
  controllers: [],
  providers: [MessageGateway],
})
export class JudgeAPIModule {}
