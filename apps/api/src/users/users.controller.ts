import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('users.view')
  findAll(@CurrentUser() user: AuthUser) {
    return this.usersService.findAll(user);
  }

  @Post()
  @RequirePermissions('users.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(user, dto);
  }

  @Get(':id')
  @RequirePermissions('users.view')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.findOne(user, id);
  }

  @Patch(':id')
  @RequirePermissions('users.update')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user, id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions('users.disable')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.updateStatus(user, id, dto);
  }
}
