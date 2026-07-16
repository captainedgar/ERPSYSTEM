import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type {
  AuthUser,
  RequestContext,
} from '../common/interfaces/auth-user.interface';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('registration-plans')
  registrationPlans() {
    return this.authService.registrationPlans();
  }

  @Public()
  @Post('register-company')
  registerCompany(@Body() dto: RegisterCompanyDto, @Req() request: Request) {
    return this.authService.registerCompany(dto, requestContext(request));
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, requestContext(request));
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refresh(dto.refreshToken, requestContext(request));
  }

  @Post('logout')
  logout(@CurrentUser() user: AuthUser, @Req() request: Request) {
    return this.authService.logout(user, requestContext(request));
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user);
  }
}

function requestContext(request: Request): RequestContext {
  return {
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  };
}
