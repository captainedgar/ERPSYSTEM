import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { BranchesService } from './branches.service';
import {
  AssignBranchUsersDto,
  BranchStatusDto,
  UpdateUserBranchesDto,
} from './dto/assign-branch-users.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @RequirePermissions('branches.view')
  findAll(@CurrentUser() user: AuthUser) {
    return this.branchesService.findAll(user);
  }

  @Get('available')
  @RequirePermissions('branches.view')
  available(@CurrentUser() user: AuthUser) {
    return this.branchesService.available(user);
  }

  @Post()
  @RequirePermissions('branches.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(user, dto);
  }

  @Get('users/:id/branches')
  @RequirePermissions('branches.assign_users')
  userBranches(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.branchesService.userBranches(user, id);
  }

  @Put('users/:id/branches')
  @RequirePermissions('branches.assign_users')
  updateUserBranches(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserBranchesDto,
  ) {
    return this.branchesService.updateUserBranches(user, id, dto);
  }

  @Get(':id')
  @RequirePermissions('branches.view')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.branchesService.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions('branches.update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchesService.update(user, id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('branches.change_status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: BranchStatusDto,
  ) {
    return this.branchesService.updateStatus(user, id, dto.active);
  }

  @Patch(':id/main')
  @RequirePermissions('branches.set_main')
  setMain(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.branchesService.setMain(user, id);
  }

  @Get(':id/users')
  @RequirePermissions('branches.assign_users')
  users(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.branchesService.users(user, id);
  }

  @Post(':id/users')
  @RequirePermissions('branches.assign_users')
  assignUsers(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignBranchUsersDto,
  ) {
    return this.branchesService.assignUsers(user, id, dto);
  }

  @Delete(':id/users/:userId')
  @RequirePermissions('branches.assign_users')
  removeUser(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.branchesService.removeUser(user, id, userId);
  }
}
