import { Global, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@/generated/prisma/client';

@Injectable()
@Global()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
