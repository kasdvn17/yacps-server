import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateProblemDTO {
  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsNotEmpty()
  points: number;

  @IsString()
  @IsOptional()
  input?: string;

  @IsString()
  @IsOptional()
  output?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  curators?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  authors?: string[];

  @IsString()
  @IsOptional()
  pdfUuid?: string;

  @IsNumber()
  @IsOptional()
  categoryId?: number;

  @IsArray()
  @IsNumber({ allowNaN: false }, { each: true })
  @IsOptional()
  types?: number[];

  @IsString()
  @IsOptional()
  solution?: string;
}
