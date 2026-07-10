import {
  CompanySubscriptionStatus,
  Currency,
  SaasBillingInterval,
  SubscriptionInvoiceStatus,
  SubscriptionPaymentMethod,
} from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSaasPlanDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsEnum(Currency)
  currency!: Currency;

  @IsEnum(SaasBillingInterval)
  billingInterval!: SaasBillingInterval;

  @IsInt()
  @Min(0)
  graceDays!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxBranches?: number;

  @IsObject()
  modules!: Record<string, boolean>;
}

export class UpdateSaasPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsEnum(SaasBillingInterval)
  billingInterval?: SaasBillingInterval;

  @IsOptional()
  @IsInt()
  @Min(0)
  graceDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxBranches?: number;

  @IsOptional()
  @IsObject()
  modules?: Record<string, boolean>;
}

export class UpdateSaasPlanStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class UpsertCompanySubscriptionDto {
  @IsString()
  planId!: string;

  @IsOptional()
  @IsEnum(CompanySubscriptionStatus)
  status?: CompanySubscriptionStatus;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  currentPeriodStart?: string;

  @IsOptional()
  @IsDateString()
  currentPeriodEnd?: string;

  @IsOptional()
  @IsDateString()
  nextPaymentDueAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  graceDays?: number;
}

export class RegisterSubscriptionPaymentDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsEnum(Currency)
  currency!: Currency;

  @IsEnum(SubscriptionPaymentMethod)
  method!: SubscriptionPaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsDateString()
  paidAt!: string;

  @IsOptional()
  @IsDateString()
  nextPaymentDueAt?: string;

  @IsOptional()
  @IsString()
  subscriptionInvoiceId?: string;
}

export class CreateSubscriptionInvoiceDto {
  @IsString()
  companyId!: string;

  @IsOptional()
  @IsString()
  companySubscriptionId?: string;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsDateString()
  billingPeriodStart!: string;

  @IsDateString()
  billingPeriodEnd!: string;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  subtotal?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total?: number;

  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @IsOptional()
  @IsEnum(SubscriptionInvoiceStatus)
  status?: SubscriptionInvoiceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class VoidSubscriptionInvoiceDto {
  @IsString()
  @MaxLength(500)
  voidReason!: string;
}
