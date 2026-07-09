import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CompaniesService, COMPANY_LOGO_MAX_BYTES } from './companies.service';
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

  @Get('me/logo')
  findMyLogo(@CurrentUser() user: AuthUser) {
    return this.companiesService.findMyLogo(user);
  }

  @Post('me/logo')
  @RequirePermissions('companies.update')
  @UseInterceptors(
    FileInterceptor('logo', {
      limits: { fileSize: COMPANY_LOGO_MAX_BYTES },
    }),
  )
  uploadMyLogo(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: UploadedCompanyLogo,
  ) {
    return this.companiesService.uploadMyLogo(user, file);
  }

  @Delete('me/logo')
  @RequirePermissions('companies.update')
  deleteMyLogo(@CurrentUser() user: AuthUser) {
    return this.companiesService.deleteMyLogo(user);
  }
}

export interface UploadedCompanyLogo {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}
