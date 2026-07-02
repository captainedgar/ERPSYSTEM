import { Body, Controller, Get, Patch } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('me')
  @RequirePermissions('companies.view')
  findMine(@CurrentUser() user: AuthUser) {
    return this.companiesService.findMine(user);
  }

  @Patch('me')
  @RequirePermissions('companies.update')
  updateMine(@CurrentUser() user: AuthUser, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.updateMine(user, dto);
  }
}
