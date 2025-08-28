import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
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

  @IsNumber()
  @Max(60, { message: 'timeLimit must not exceed 60 seconds' })
  timeLimit: number;

  @IsNumber()
  memoryLimit: number;

  @IsBoolean()
  @IsOptional()
  short_circuit?: boolean;

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
  pdf?: string;

  @IsNumber()
  @IsOptional()
  categoryId?: number;

  @IsArray()
  @IsNumber({ allowNaN: false }, { each: true })
  @IsOptional()
  types?: number[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedLanguages?: string[];

  @IsString()
  @IsOptional()
  solution?: string;
}

export class UpdateProblemDTO {
  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Max(60, { message: 'timeLimit must not exceed 60 seconds' })
  timeLimit: number;

  @IsNumber()
  memoryLimit: number;

  @IsNumber()
  @IsOptional()
  categoryId?: number;

  @IsArray()
  @IsNumber({ allowNaN: false }, { each: true })
  @IsOptional()
  types?: number[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedLanguages?: string[];

  @IsString()
  @IsOptional()
  pdf?: string;

  @IsBoolean()
  @IsOptional()
  short_circuit?: boolean;
}
