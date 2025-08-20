import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Config } from 'config';

@Injectable()
export class Argon2Service {
  private readonly logger = new Logger(Argon2Service.name);

  /**
   * Hash a password using Argon2
   * @param password The password to hash
   * @returns The promise of hashed password
   */
  async hashPassword(password: string): Promise<string> {
    return await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: Config.ARGON2ID.memoryCost,
      timeCost: Config.ARGON2ID.timeCost,
      parallelism: Config.ARGON2ID.parallelism,
    });
  }

  /**
   * Compare a password
   * @param plain The plain text password to compare
   * @param encrypted The encrypted password to compare against
   * @returns The promise of boolean indicating if the passwords match
   */
  async comparePassword(plain: string, encrypted: string): Promise<boolean> {
    try {
      return await argon2.verify(encrypted, plain);
    } catch (error) {
      this.logger.error('Error comparing password:', error.stack || error);
      return false;
    }
  }
}
