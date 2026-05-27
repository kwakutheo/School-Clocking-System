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
