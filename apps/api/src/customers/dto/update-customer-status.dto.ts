import { CustomerStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateCustomerStatusDto {
  @IsEnum(CustomerStatus)
  status!: CustomerStatus;
}
