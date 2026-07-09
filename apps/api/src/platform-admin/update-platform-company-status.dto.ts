import { CompanyStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdatePlatformCompanyStatusDto {
  @IsEnum(CompanyStatus)
  status!: CompanyStatus;
}
