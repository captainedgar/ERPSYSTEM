import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PosSearchQueryDto } from './dto/pos-search-query.dto';
import { ValidateCartDto } from './dto/validate-cart.dto';
import { PosService } from './pos.service';

@Controller('pos')
export class PosController {
  constructor(private readonly service: PosService) {}

  @Get('search-items')
  @RequirePermissions('pos.access')
  searchItems(
    @CurrentUser() user: AuthUser,
    @Query() query: PosSearchQueryDto,
  ) {
    return this.service.searchItems(user, query);
  }

  @Post('validate-cart')
  @RequirePermissions('pos.validate_cart')
  validateCart(@CurrentUser() user: AuthUser, @Body() dto: ValidateCartDto) {
    return this.service.validateCart(user, dto);
  }
}
