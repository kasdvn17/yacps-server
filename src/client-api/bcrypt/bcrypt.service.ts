import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const saltRounds = process.env.BCRYPT_SALT;

@Injectable()
export class BcryptService {
  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(parseInt(saltRounds as string) || 12);
    return await bcrypt.hash(password, salt);
  }

  async comparePassword(plain: string, encrypted: string): Promise<boolean> {
    return await bcrypt.compare(plain, encrypted);
  }
}
