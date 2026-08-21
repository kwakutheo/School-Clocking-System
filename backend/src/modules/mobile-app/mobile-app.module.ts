import { Module } from '@nestjs/common';
import { MobileAppController } from './mobile-app.controller';
import { MobileAppService } from './mobile-app.service';

@Module({
  controllers: [MobileAppController],
  providers: [MobileAppService],
})
export class MobileAppModule {}
