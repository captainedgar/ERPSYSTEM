import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { Public } from '../common/decorators/public.decorator';
import { CurrentPlatformUser } from './current-platform-user.decorator';
import { PlatformLoginDto } from './platform-auth.dto';
import { PlatformAuthGuard } from './platform-auth.guard';
import { PlatformAuthService } from './platform-auth.service';
import type {
  PlatformAuthUser,
  PlatformRequestContext,
} from './platform.types';

@Public()
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly auth: PlatformAuthService) {}

  @Post('login')
  login(@Body() dto: PlatformLoginDto, @Req() request: Request) {
    return this.auth.login(dto, requestContext(request));
  }

  @UseGuards(PlatformAuthGuard)
  @Post('logout')
  logout(
    @CurrentPlatformUser() user: PlatformAuthUser,
    @Req() request: Request,
  ) {
    return this.auth.logout(user, requestContext(request));
  }

  @UseGuards(PlatformAuthGuard)
  @Get('me')
  me(@CurrentPlatformUser() user: PlatformAuthUser) {
    return this.auth.me(user);
  }
}

function requestContext(request: Request): PlatformRequestContext {
  return {
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  };
}
