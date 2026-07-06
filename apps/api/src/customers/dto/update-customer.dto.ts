import { OmitType, PartialType } from '@nestjs/mapped-types';

import { CreateCustomerDto } from './create-customer.dto';

export class UpdateCustomerDto extends PartialType(
  OmitType(CreateCustomerDto, ['status'] as const),
) {}
