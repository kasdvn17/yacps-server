import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Config } from 'config';

@Injectable()
export class Argon2Service {
  async hashPassword(password: string): Promise<string> {
    return await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: Config.ARGON2ID.memoryCost,
      timeCost: Config.ARGON2ID.timeCost,
      parallelism: Config.ARGON2ID.parallelism,
    });
  }

  async comparePassword(plain: string, encrypted: string): Promise<boolean> {
    try {
      return await argon2.verify(encrypted, plain);
    } catch (error) {
      this.logger.error('Error comparing password:', error.stack || error);
      return false;
    }
  }
}
