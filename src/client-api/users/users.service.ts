import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prismaService: PrismaService) {}

  async findUser(fields: Partial<User>): Promise<User | null> {
    return (
      (await this.prismaService.user.findFirst({
        where: fields,
      })) || null
    );
  }
  async findUsers(fields: Partial<User>): Promise<User[]> {
    const users = await this.prismaService.user.findMany({
      where: fields,
    });
    return users;
  }
}
