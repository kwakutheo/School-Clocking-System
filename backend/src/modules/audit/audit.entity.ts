import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

@Entity('audit_logs')
export class AuditLog extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User; // Who performed the action

  @Column()
  action: string; // e.g., 'UPDATE_EMPLOYEE_SALARY', 'APPROVE_PAYROLL'

  @Column()
  module: string; // e.g., 'EMPLOYEES', 'PAYROLL', 'ATTENDANCE'

  @Column({ nullable: true })
  targetId: string; // The ID of the record being changed

  @Column({ type: 'jsonb', nullable: true })
  oldValues: any;

  @Column({ type: 'jsonb', nullable: true })
  newValues: any;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
