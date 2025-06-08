import { PrismaService } from '@/prisma/prisma.service';
import { Global, Injectable } from '@nestjs/common';
import { User } from '@prisma/client';

@Global()
@Injectable()
export class UsersService {
  constructor(private prismaService: PrismaService) {}

  async findUser(
    fields: Partial<User>,
    isDeleted: boolean = false,
    includeHash: boolean = false,
  ): Promise<User | null> {
    return (
      (await this.prismaService.user.findFirst({
        where: {
          ...fields,
          isDeleted,
        },
        omit: {
          password: !includeHash,
        },
      })) || null
    );
  }

  async findUsers(
    fields: Partial<User>,
    isDeleted: boolean = false,
    includeHash: boolean = false,
  ): Promise<User[]> {
    const users = await this.prismaService.user.findMany({
      where: {
        ...fields,
        isDeleted,
      },
      omit: {
        password: !includeHash,
      },
    });
    return users;
  }
}
