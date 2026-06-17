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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
