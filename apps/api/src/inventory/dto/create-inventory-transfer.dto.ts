import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateInventoryTransferDto {
  @IsString()
  @IsNotEmpty()
  fromBranchId!: string;

  @IsString()
  @IsNotEmpty()
  toBranchId!: string;

  @IsString()
  @IsNotEmpty()
  productId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note?: string;
}
