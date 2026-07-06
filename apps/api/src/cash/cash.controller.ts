import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CashService } from './cash.service';
import { CashSessionsQueryDto } from './dto/cash-sessions-query.dto';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { ManualCashMovementDto } from './dto/manual-cash-movement.dto';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';

@Controller('cash')
export class CashController {
  constructor(private readonly service: CashService) {}

  @Get('current')
  @RequirePermissions('cash.view')
  async current(@CurrentUser() user: AuthUser) {
    return { session: await this.service.current(user) };
  }

  @Get('sessions')
  @RequirePermissions('cash.view_sessions')
  sessions(
    @CurrentUser() user: AuthUser,
    @Query() query: CashSessionsQueryDto,
  ) {
    return this.service.findAll(user, query);
  }

  @Get('sessions/:id')
  @RequirePermissions('cash.view_sessions')
  session(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user, id);
  }

  @Post('open')
  @RequirePermissions('cash.open')
  open(@CurrentUser() user: AuthUser, @Body() dto: OpenCashSessionDto) {
    return this.service.open(user, dto);
  }

  @Post('close')
  @RequirePermissions('cash.close')
  close(@CurrentUser() user: AuthUser, @Body() dto: CloseCashSessionDto) {
    return this.service.close(user, dto);
  }

  @Post('movements/manual-in')
  @RequirePermissions('cash.manual_movement')
  manualIn(@CurrentUser() user: AuthUser, @Body() dto: ManualCashMovementDto) {
    return this.service.manualMovement(user, dto, 'MANUAL_IN');
  }

  @Post('movements/manual-out')
  @RequirePermissions('cash.manual_movement')
  manualOut(@CurrentUser() user: AuthUser, @Body() dto: ManualCashMovementDto) {
    return this.service.manualMovement(user, dto, 'MANUAL_OUT');
  }
}
