import { IsString, IsInt, IsOptional, Length } from 'class-validator';

export class CreateSubmissionDTO {
  @IsString()
  problemSlug: string;

  @IsString()
  @Length(1, 100)
  language: string;

  @IsString()
  @Length(1, 65535)
  code: string;

  @IsOptional()
  @IsInt()
  contestantId?: number;

  // removed since enforcement is handled in service layer
  // @IsOptional()
  // @IsBoolean()
  // isPretest?: boolean;
}

export class SubmissionQueryDTO {
  @IsOptional()
  @IsString()
  problemSlug?: string;

  @IsOptional()
  @IsString()
  authorId?: string;

  @IsOptional()
  @IsInt()
  problemId?: number;

  @IsOptional()
  @IsInt()
  contestantId?: number;

  @IsOptional()
  @IsString()
  verdict?: string;

  @IsOptional()
  @IsInt()
  page?: number = 1;

  @IsOptional()
  @IsInt()
  limit?: number = 20;
}
