import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ExportFormat {
  CSV = 'csv',
  XLSX = 'xlsx',
}

export enum ExportScope {
  ACTIVE_BRANCH = 'active_branch',
  ALL_BRANCHES = 'all_branches',
}

export class DataExportQueryDto {
  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat = ExportFormat.XLSX;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsEnum(ExportScope)
  scope?: ExportScope = ExportScope.ACTIVE_BRANCH;
}
