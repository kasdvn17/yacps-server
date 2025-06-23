import { IsNotEmpty, IsString } from 'class-validator';

export class CreateProblemDTO {
  @IsString()
  @IsNotEmpty()
  slug: string;
}
