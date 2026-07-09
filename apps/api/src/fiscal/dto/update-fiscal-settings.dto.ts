import { FiscalEnvironment, FiscalProviderMode } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateFiscalSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  rnc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  commercialName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  economicActivity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  fiscalAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  municipality?: string;

  @IsOptional()
  @IsEnum(FiscalEnvironment)
  environment?: FiscalEnvironment;

  @IsOptional()
  @IsEnum(FiscalProviderMode)
  providerMode?: FiscalProviderMode;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
