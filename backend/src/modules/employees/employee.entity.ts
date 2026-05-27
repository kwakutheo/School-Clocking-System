import {
  Entity, PrimaryGeneratedColumn, Column,
  OneToOne, JoinColumn, ManyToOne, OneToMany,
  CreateDateColumn, UpdateDateColumn, Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Department } from '../departments/department.entity';
import { Branch } from '../branches/branch.entity';
import { Shift } from '../shifts/shift.entity';
import { EmployeeStatus } from '../../common/enums';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

@Entity('employees')
@Unique(['tenantId', 'employeeCode'])
export class Employee extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'employee_code' })
  employeeCode: string;

  @ManyToOne(() => Department, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @ManyToOne(() => Branch, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @ManyToOne(() => Shift, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'shift_id' })
  shift: Shift;

  @Column({ nullable: true })
  position: string;

  @Column({ name: 'hire_date', type: 'date', nullable: true })
  hireDate: Date;

  @Column({ name: 'photo_url', nullable: true })
  photoUrl: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: EmployeeStatus.ACTIVE,
  })
  status: EmployeeStatus;

  @Column({ name: 'status_change_date', type: 'date', nullable: true })
  statusChangeDate: Date;

  @OneToMany('EmployeeStatusLog', 'employee', { cascade: true })
  statusLogs: any[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
