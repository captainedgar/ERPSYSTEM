import { BusinessType } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ApplyBusinessTemplateDto {
  @IsEnum(BusinessType)
  businessType!: BusinessType;
}
