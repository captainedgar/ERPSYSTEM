import {
  BusinessType,
  Currency,
  DocumentType,
  PaymentMethod,
} from '@prisma/client';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateBusinessSettingsDto {
  @IsOptional()
  @IsEnum(BusinessType)
  businessType?: BusinessType;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;

  @IsOptional()
  @IsBoolean()
  requireOpenCashForSales?: boolean;

  @IsOptional()
  @IsEnum(DocumentType)
  defaultDocumentType?: DocumentType;

  @IsOptional()
  @IsEnum(PaymentMethod)
  defaultPaymentMethod?: PaymentMethod;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(PaymentMethod, { each: true })
  enabledPaymentMethods?: PaymentMethod[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  receiptFooterText?: string;

  @IsOptional()
  @IsBoolean()
  printLogo?: boolean;

  @IsOptional()
  @IsBoolean()
  posQuickSaleMode?: boolean;

  @IsOptional()
  @IsBoolean()
  posShowStock?: boolean;

  @IsOptional()
  @IsBoolean()
  posAllowDiscounts?: boolean;

  @IsOptional()
  @IsBoolean()
  cashRequireOpeningAmount?: boolean;

  @IsOptional()
  @IsBoolean()
  cashAllowExpenses?: boolean;
}
