import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AttendanceSummaryJob } from '../src/modules/saas-admin/attendance-summary.job';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const job = app.get(AttendanceSummaryJob);
  console.log('Running recompute...');
  const start = new Date();
  start.setDate(start.getDate() - 1);
  const end = new Date();
  end.setDate(end.getDate() + 1);
  await job.recompute(start, end);
  console.log('Recompute complete!');
  await app.close();
}

bootstrap().catch(console.error);
