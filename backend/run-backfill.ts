import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AttendanceSummaryJob } from './src/modules/saas-admin/attendance-summary.job';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('BackfillScript');
  logger.log('Initializing application context...');
  
  // Create a standalone application context (no HTTP server)
  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    const job = app.get(AttendanceSummaryJob);
    logger.log('Starting historical backfill job...');
    
    const t0 = Date.now();
    await job.runNightly();
    
    logger.log(`Backfill completed successfully in ${Date.now() - t0}ms`);
  } catch (error) {
    logger.error('Error during backfill:', error);
  } finally {
    await app.close();
    logger.log('Application context closed. Exiting.');
    process.exit(0);
  }
}

bootstrap();
