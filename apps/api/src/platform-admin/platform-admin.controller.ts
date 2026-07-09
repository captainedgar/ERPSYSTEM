import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { Public } from '../common/decorators/public.decorator';
import { CurrentPlatformUser } from './current-platform-user.decorator';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAuthGuard } from './platform-auth.guard';
import type {
  PlatformAuthUser,
  PlatformRequestContext,
} from './platform.types';
import { UpdatePlatformCompanyStatusDto } from './update-platform-company-status.dto';

@Public()
@UseGuards(PlatformAuthGuard)
@Controller('platform')
export class PlatformAdminController {
  constructor(private readonly platform: PlatformAdminService) {}

  @Get('metrics')
  metrics() {
    return this.platform.getGlobalMetrics();
  }

  @Get('audit-logs')
  auditLogs() {
    return this.platform.listAuditLogs();
  }

  @Get('companies')
  companies(@Query('search') search?: string) {
    return this.platform.listCompanies(search);
  }

  @Get('companies/:id')
  company(@Param('id') id: string) {
    return this.platform.getCompany(id);
  }

  @Patch('companies/:id/status')
  updateCompanyStatus(
    @CurrentPlatformUser() user: PlatformAuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePlatformCompanyStatusDto,
    @Req() request: Request,
  ) {
    return this.platform.updateCompanyStatus(
      user,
      id,
      dto,
      requestContext(request),
    );
  }

  @Get('companies/:id/users')
  companyUsers(@Param('id') id: string) {
    return this.platform.listCompanyUsers(id);
  }

  @Get('companies/:id/metrics')
  companyMetrics(@Param('id') id: string) {
    return this.platform.getCompanyMetrics(id);
  }
}

function requestContext(request: Request): PlatformRequestContext {
  return {
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  };
}
