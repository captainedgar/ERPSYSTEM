import { IsIn } from 'class-validator';

export class RequestPlanChangeDto {
  @IsIn(['BASIC', 'PRO', 'PREMIUM', 'ENTERPRISE'])
  planCode!: 'BASIC' | 'PRO' | 'PREMIUM' | 'ENTERPRISE';
}
