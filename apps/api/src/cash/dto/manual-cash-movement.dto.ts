import { IsNumber, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class ManualCashMovementDto {
  @IsString()
  @MinLength(10)
  cashSessionId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
