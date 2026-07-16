import { BusinessType } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterCompanyDto {
  @IsOptional()
  @IsIn(['BASIC', 'PRO', 'PREMIUM', 'ENTERPRISE'])
  planCode?: 'BASIC' | 'PRO' | 'PREMIUM' | 'ENTERPRISE';

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  rncOrCedula?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  companyPhone?: string;

  @IsOptional()
  @IsEmail()
  companyEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;

  @IsEnum(BusinessType)
  businessType!: BusinessType;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  ownerName!: string;

  @IsEmail()
  ownerEmail!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
