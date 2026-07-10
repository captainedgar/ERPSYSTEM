import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class ReportsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  branchId?: string;
}
