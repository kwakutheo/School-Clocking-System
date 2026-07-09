import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Returns the server's authoritative current date and time.
   * The server process is pinned to Africa/Accra (UTC+0, no DST) via
   * process.env.TZ in main.ts, so `new Date()` already reflects Ghana time.
   *
   * Intentionally PUBLIC (no JwtAuthGuard) — the dashboard calls this to
   * detect and correct a skewed device clock.
   */
  @Get('time')
  getServerTime() {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return {
      iso: now.toISOString(),
      date: dateStr,        // e.g. "2026-07-08" — the authoritative "today"
      timezone: process.env.TZ ?? 'Africa/Accra',
    };
  }
}
