import { PrismaService } from '@/prisma/prisma.service';
import { Global, Injectable } from '@nestjs/common';
import { User } from '@prisma/client';

@Global()
@Injectable()
export class UsersService {
  constructor(private prismaService: PrismaService) {}

  /**
   * Find a user by given fields.
   * @param fields Fields to search for
   * @param isDeleted Whether to search for deleted users only
   * @param includeHash Whether to include the password hash in the result
   * @returns Return the user object
   */
  async findUser(
    fields: Partial<User>,
    isDeleted: boolean | undefined,
    includeHash: boolean | undefined,
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

  /**
   * Find multiple users by given fields.
   * @param fields Fields to search for
   * @param isDeleted Whether to search for deleted users only
   * @param includeHash Whether to include the password hash in the result
   * @param limit Maximum number of users to return
   * @returns Array of users matching the criteria
   */
  async findUsers(
    fields: Partial<User>,
    isDeleted: boolean = false,
    includeHash: boolean = false,
    limit: number = 10,
  ): Promise<User[]> {
    const users = await this.prismaService.user.findMany({
      where: {
        ...fields,
        isDeleted,
      },
      omit: {
        password: !includeHash,
      },
      take: limit,
    });
    return users;
  }
}
