import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { SessionsService } from './sessions.service';

@Module({
  imports: [JwtModule.register({})],
  providers: [SessionsService],
  exports: [SessionsService, JwtModule],
})
export class SessionsModule {}
