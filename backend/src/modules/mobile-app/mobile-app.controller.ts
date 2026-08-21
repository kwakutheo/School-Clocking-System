import { Controller, Get } from '@nestjs/common';
import { MobileAppService } from './mobile-app.service';

@Controller('mobile-app')
export class MobileAppController {
  constructor(private readonly mobileAppService: MobileAppService) {}

  @Get('latest')
  getLatestAndroidVersion() {
    return this.mobileAppService.getLatestAndroidVersion();
  }
}
