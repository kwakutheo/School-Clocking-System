import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { Branch } from '../branches/branch.entity';
import { AttendanceType } from '../../common/enums';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

import { User } from '../users/user.entity';

@Entity('attendance_logs')
@Index(['employee', 'timestamp'])
@Index(['employee', 'type', 'timestamp'])
@Index(['tenantId', 'timestamp'])
@Index(['type', 'timestamp'])
export class AttendanceLog extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @ManyToOne(() => Branch, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({
    type: 'varchar',
    length: 20,
  })
  type: AttendanceType;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @Column({ name: 'device_id', nullable: true })
  deviceId: string;

  @Column({ type: 'numeric', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'numeric', precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column({ name: 'selfie_url', nullable: true })
  selfieUrl: string;

  @Column({ name: 'is_late', default: false })
  isLate: boolean;

  @Column({ name: 'is_excused_late', default: false })
  isExcusedLate: boolean;

  @Column({ name: 'excuse_reason', type: 'text', nullable: true })
  excuseReason: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'excused_by_id' })
  excusedBy: User | null;

  @Column({ name: 'is_early_out', default: false })
  isEarlyOut: boolean;

  @Column({ name: 'is_excused_early_out', default: false })
  isExcusedEarlyOut: boolean;

  @Column({ name: 'excuse_early_out_reason', type: 'text', nullable: true })
  excuseEarlyOutReason: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'early_out_excused_by_id' })
  earlyOutExcusedBy: User | null;

  @Column({ name: 'is_offline_sync', default: false })
  isOfflineSync: boolean;

  @Column({ name: 'is_admin_override', default: false })
  isAdminOverride: boolean;

  @Column({ name: 'admin_note', nullable: true })
  adminNote: string;

  @Column({ name: 'admin_override_name', nullable: true })
  adminOverrideName: string;

  /**
   * Shift Snapshot Columns
   * Written once at the moment of CLOCK_IN / CLOCK_OUT and never changed.
   * These make all lateness/early-out calculations in reports immutable and
   * immune to future edits of the shift or employee reassignments.
   */

  /** The shift start time active when this CLOCK_IN was recorded (e.g. "07:00:00"). */
  @Column({
    name: 'scheduled_start_time',
    type: 'varchar',
    length: 8,
    nullable: true,
  })
  scheduledStartTime: string | null;

  /** The shift end time active when this CLOCK_OUT was recorded (e.g. "14:00:00"). */
  @Column({
    name: 'scheduled_end_time',
    type: 'varchar',
    length: 8,
    nullable: true,
  })
  scheduledEndTime: string | null;

  /** The grace period in minutes active when this CLOCK_IN was recorded. */
  @Column({ name: 'scheduled_grace_minutes', type: 'int', nullable: true })
  scheduledGraceMinutes: number | null;

  /** Minutes late, calculated and frozen at CLOCK_IN time. 0 means on-time. */
  @Column({ name: 'late_minutes', type: 'int', nullable: true })
  lateMinutes: number | null;

  /** Minutes early, calculated and frozen at CLOCK_OUT time. 0 means on-time. */
  @Column({ name: 'early_out_minutes', type: 'int', nullable: true })
  earlyOutMinutes: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
