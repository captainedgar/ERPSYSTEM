import {
  ElectronicDocumentType,
  ElectronicInvoiceStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const MOCK_FISCAL_OUTCOMES = [
  'ACCEPTED',
  'REJECTED',
  'FAILED',
  'PENDING',
] as const;

export type MockFiscalOutcome = (typeof MOCK_FISCAL_OUTCOMES)[number];

export class CreateElectronicInvoiceDto {
  @IsOptional()
  @IsEnum(ElectronicDocumentType)
  documentType?: ElectronicDocumentType;
}

export class FiscalSendDto {
  @IsOptional()
  @IsIn(MOCK_FISCAL_OUTCOMES)
  mockOutcome?: MockFiscalOutcome;
}

export class ElectronicInvoicesQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ElectronicInvoiceStatus)
  status?: ElectronicInvoiceStatus;

  @IsOptional()
  @IsEnum(ElectronicDocumentType)
  documentType?: ElectronicDocumentType;

  @IsOptional()
  @IsString()
  saleId?: string;

  @IsOptional()
  @IsString()
  internalDocumentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
