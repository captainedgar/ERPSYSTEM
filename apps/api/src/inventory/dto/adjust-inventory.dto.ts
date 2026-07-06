import { InventoryMovementType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsString, MaxLength, Min } from 'class-validator';

export class AdjustInventoryDto {
  @IsIn([
    InventoryMovementType.ADJUSTMENT_IN,
    InventoryMovementType.ADJUSTMENT_OUT,
  ])
  type!: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @IsString()
  @MaxLength(500)
  reason!: string;
}
