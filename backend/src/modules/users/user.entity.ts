import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { UserRole } from '../../common/enums';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

@Entity('users')
export class User extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true })
  @Index()
  phone: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true })
  @Index()
  username: string | null;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: UserRole.EMPLOYEE,
  })
  role: UserRole;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'requires_password_change', default: false })
  requiresPasswordChange: boolean;

  @Column({ name: 'reset_pin', type: 'varchar', nullable: true })
  resetPin: string | null;

  @Column({ name: 'reset_pin_expires_at', type: 'timestamp', nullable: true })
  resetPinExpiresAt: Date | null;

  @Column({ name: 'reset_pin_attempts', type: 'int', default: 0 })
  resetPinAttempts: number;

  @Column({ name: 'fcm_token', type: 'text', nullable: true })
  fcmToken: string | null;

  @Column({ name: 'is_dashboard_blocked', default: false })
  isDashboardBlocked: boolean;

  @Column({ name: 'dashboard_block_reason', type: 'text', nullable: true })
  dashboardBlockReason: string | null;

  @Column({ name: 'dashboard_blocked_at', type: 'timestamp', nullable: true })
  dashboardBlockedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'last_login_at', type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;

  @Column({ name: 'mfa_enabled', default: false })
  mfaEnabled: boolean;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
