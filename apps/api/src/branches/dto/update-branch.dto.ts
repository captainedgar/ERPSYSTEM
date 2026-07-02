import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { BranchStatus } from '@prisma/client';

import { CreateBranchDto } from './create-branch.dto';

export class UpdateBranchDto extends PartialType(CreateBranchDto) {
  @IsOptional()
  @IsEnum(BranchStatus)
  status?: BranchStatus;
}
