import {
  ProductAlternativeCodeType,
  ProductCompatibilityGroupStatus,
  ProductSubstituteType,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCompatibilityGroupDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(80)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateCompatibilityGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateCompatibilityGroupStatusDto {
  @IsEnum(ProductCompatibilityGroupStatus)
  status!: ProductCompatibilityGroupStatus;
}

export class AddProductToGroupDto {
  @IsString()
  productId!: string;
}

export class AddAlternativeCodeDto {
  @IsString()
  @MaxLength(120)
  code!: string;

  @IsOptional()
  @IsEnum(ProductAlternativeCodeType)
  type?: ProductAlternativeCodeType;
}

export class AddSubstituteDto {
  @IsString()
  substituteProductId!: string;

  @IsOptional()
  @IsEnum(ProductSubstituteType)
  type?: ProductSubstituteType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isBidirectional?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}

export class CompatibilityQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
