import { IsEmail, IsNotEmpty } from 'class-validator';

export class CreateSessionDTO {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  password: string;
}
