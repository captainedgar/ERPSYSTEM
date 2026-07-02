import { Body, Controller, Get, Patch } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { BusinessSettingsService } from './business-settings.service';
import { UpdateBusinessSettingsDto } from './dto/update-business-settings.dto';

@Controller('business-settings')
export class BusinessSettingsController {
  constructor(private readonly settingsService: BusinessSettingsService) {}

  @Get()
  @RequirePermissions('settings.view')
  findMine(@CurrentUser() user: AuthUser) {
    return this.settingsService.findMine(user);
  }

  @Patch()
  @RequirePermissions('settings.update')
  updateMine(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateBusinessSettingsDto,
  ) {
    return this.settingsService.updateMine(user, dto);
  }
}
