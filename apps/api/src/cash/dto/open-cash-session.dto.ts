import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class OpenCashSessionDto {
  @IsString()
  @MinLength(10)
  branchId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingAmount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
