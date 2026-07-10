import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class AssignBranchUsersDto {
  @IsArray()
  @IsString({ each: true })
  userIds!: string[];

  @IsOptional()
  @IsString()
  defaultUserId?: string;
}

export class UpdateUserBranchesDto {
  @IsArray()
  @IsString({ each: true })
  branchIds!: string[];

  @IsOptional()
  @IsString()
  defaultBranchId?: string;
}

export class BranchStatusDto {
  @IsBoolean()
  active!: boolean;
}
