import { IsEmail, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateSessionDTO {
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  userAgent?: string;

  @IsOptional()
  @IsString()
  clientIp?: string;

  @IsOptional()
  @IsString()
  captchaToken?: string;
}
