import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CloseCashSessionDto {
  @IsString()
  @MinLength(10)
  cashSessionId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  countedCashAmount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
