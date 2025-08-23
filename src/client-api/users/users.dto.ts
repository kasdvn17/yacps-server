import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateUserDTO {
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(4, {
    message: 'Username must be at least 4 characters long',
  })
  @MaxLength(30, {
    message: 'Username must be no more than 30 characters long',
  })
  @Matches(/^[a-zA-Z0-9\-_.]+$/, {
    message:
      'Username can only contain letters, numbers, hyphens (-), underscores (_), and dots (.)',
  })
  username: string;

  @IsString()
  @IsOptional()
  fullname?: string;

  @IsOptional()
  @IsString()
  captchaToken?: string;

  @IsOptional()
  @IsString()
  clientIp?: string;

  @IsString()
  @IsNotEmpty()
  defaultRuntime?: string;
}
