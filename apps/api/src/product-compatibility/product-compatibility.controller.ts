import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  AddAlternativeCodeDto,
  AddProductToGroupDto,
  AddSubstituteDto,
  CompatibilityQueryDto,
  CreateCompatibilityGroupDto,
  UpdateCompatibilityGroupDto,
  UpdateCompatibilityGroupStatusDto,
} from './dto/product-compatibility.dto';
import { ProductCompatibilityService } from './product-compatibility.service';

@Controller()
export class ProductCompatibilityController {
  constructor(private readonly service: ProductCompatibilityService) {}

  @Get('product-compatibility/groups')
  @RequirePermissions('product_compatibility.view')
  listGroups(
    @CurrentUser() user: AuthUser,
    @Query() query: CompatibilityQueryDto,
  ) {
    return this.service.listGroups(user, query);
  }

  @Post('product-compatibility/groups')
  @RequirePermissions('product_compatibility.manage')
  createGroup(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCompatibilityGroupDto,
  ) {
    return this.service.createGroup(user, dto);
  }

  @Get('product-compatibility/groups/:id')
  @RequirePermissions('product_compatibility.view')
  getGroup(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getGroup(user, id);
  }

  @Patch('product-compatibility/groups/:id')
  @RequirePermissions('product_compatibility.manage')
  updateGroup(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCompatibilityGroupDto,
  ) {
    return this.service.updateGroup(user, id, dto);
  }

  @Patch('product-compatibility/groups/:id/status')
  @RequirePermissions('product_compatibility.manage')
  updateGroupStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCompatibilityGroupStatusDto,
  ) {
    return this.service.updateGroupStatus(user, id, dto);
  }

  @Post('product-compatibility/groups/:id/products')
  @RequirePermissions('product_compatibility.manage')
  addProductToGroup(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddProductToGroupDto,
  ) {
    return this.service.addProductToGroup(user, id, dto);
  }

  @Delete('product-compatibility/groups/:id/products/:productId')
  @RequirePermissions('product_compatibility.manage')
  removeProductFromGroup(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('productId') productId: string,
  ) {
    return this.service.removeProductFromGroup(user, id, productId);
  }

  @Get('products/:id/compatibility')
  @RequirePermissions('product_compatibility.view')
  getProductCompatibility(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.service.listProductCompatibility(user, id);
  }

  @Post('products/:id/compatibility/groups')
  @RequirePermissions('product_compatibility.manage')
  addProductCompatibilityGroup(
    @CurrentUser() user: AuthUser,
    @Param('id') productId: string,
    @Body('groupId') groupId: string,
  ) {
    return this.service.addProductToGroup(user, groupId, { productId });
  }

  @Delete('products/:id/compatibility/groups/:groupId')
  @RequirePermissions('product_compatibility.manage')
  removeProductCompatibilityGroup(
    @CurrentUser() user: AuthUser,
    @Param('id') productId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.service.removeProductFromGroup(user, groupId, productId);
  }

  @Get('products/:id/alternative-codes')
  @RequirePermissions('product_compatibility.view')
  listAlternativeCodes(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.listAlternativeCodes(user, id);
  }

  @Post('products/:id/alternative-codes')
  @RequirePermissions('product_compatibility.manage')
  addAlternativeCode(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddAlternativeCodeDto,
  ) {
    return this.service.addAlternativeCode(user, id, dto);
  }

  @Delete('products/:id/alternative-codes/:codeId')
  @RequirePermissions('product_compatibility.manage')
  removeAlternativeCode(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('codeId') codeId: string,
  ) {
    return this.service.removeAlternativeCode(user, id, codeId);
  }

  @Get('products/:id/substitutes')
  @RequirePermissions('product_compatibility.view')
  listSubstitutes(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.listSubstitutes(user, id);
  }

  @Post('products/:id/substitutes')
  @RequirePermissions('product_compatibility.manage')
  addSubstitute(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddSubstituteDto,
  ) {
    return this.service.addSubstitute(user, id, dto);
  }

  @Delete('products/:id/substitutes/:substituteId')
  @RequirePermissions('product_compatibility.manage')
  removeSubstitute(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('substituteId') substituteId: string,
  ) {
    return this.service.removeSubstitute(user, id, substituteId);
  }

  @Get('pos/items/:id/alternatives')
  @RequirePermissions('pos.access')
  posAlternativesForItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.service.alternativesForProduct(user, id);
  }

  @Get('pos/alternatives')
  @RequirePermissions('pos.access')
  posAlternativesByCode(
    @CurrentUser() user: AuthUser,
    @Query('query') query: string,
  ) {
    return this.service.alternativesByCode(user, query ?? '');
  }
}
