import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceLog } from './attendance-log.entity';

@Processor('attendance_queue')
export class AttendanceProcessor {
  constructor(
    @InjectRepository(AttendanceLog)
    private readonly repo: Repository<AttendanceLog>,
  ) {}

  @Process('process-clockin')
  async handleClockIn(job: Job<any>) {
    const data = job.data;
    
    // We create the log using the raw relational IDs to avoid heavy database lookups
    const log = this.repo.create({
      employee: { id: data.employeeId },
      branch: data.branchId ? { id: data.branchId } : undefined,
      type: data.type,
      timestamp: new Date(data.timestamp),
      latitude: data.latitude,
      longitude: data.longitude,
      deviceId: data.deviceId,
      isOfflineSync: data.isOfflineSync ?? false,
      isLate: data.isLate ?? false,
    });

    try {
      await this.repo.save(log);
      // Optional: Add logging or emit events (e.g., websockets) here when saved
    } catch (error) {
      console.error(`Failed to process clock-in job ${job.id}:`, error);
      // Let Bull handle retries
      throw error;
    }
  }
}
