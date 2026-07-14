import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum FinancialDashboardScope {
  ACTIVE_BRANCH = 'active_branch',
  ALL_BRANCHES = 'all_branches',
}

export class FinancialDashboardQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsEnum(FinancialDashboardScope)
  scope?: FinancialDashboardScope = FinancialDashboardScope.ACTIVE_BRANCH;

  @IsOptional()
  @IsString()
  branchId?: string;
}
