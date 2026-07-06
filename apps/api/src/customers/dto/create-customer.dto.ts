import {
  CustomerDocumentType,
  CustomerStatus,
  CustomerType,
  TaxpayerType,
} from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCustomerDto {
  @IsEnum(CustomerType)
  type!: CustomerType;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  @Matches(/\S/, { message: 'name must contain visible characters' })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  commercialName?: string | null;

  @IsEnum(CustomerDocumentType)
  documentType!: CustomerDocumentType;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  documentNumber?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  mobile?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string | null;

  @IsEnum(TaxpayerType)
  taxpayerType!: TaxpayerType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  paymentTermsDays?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditLimit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;
}
