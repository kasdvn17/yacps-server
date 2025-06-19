import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateSessionDTO {
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}
