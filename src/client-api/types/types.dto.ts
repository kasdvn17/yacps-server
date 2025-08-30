import { IsString, IsNotEmpty } from 'class-validator';

export class CreateTypesDTO {
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  names: string[];
}
