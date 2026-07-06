import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { PosItemType } from '../pos.types';

export class ValidateCartItemDto {
  @IsEnum(PosItemType)
  itemType!: PosItemType;

  @IsString()
  @MinLength(10)
  itemId!: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  quantity!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  discountAmount?: number;
}

export class ValidateCartDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  customerId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ValidateCartItemDto)
  items!: ValidateCartItemDto[];
}
