import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Employee } from './employee.entity';
import { EmployeeStatus } from '../../common/enums';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

@Entity('employee_status_logs')
export class EmployeeStatusLog extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Explicit FK column so we can index by employeeId without a join */
  @Column({ name: 'employee_id', type: 'uuid' })
  @Index()
  employeeId: string;

  @ManyToOne(() => Employee, (employee) => employee.statusLogs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({
    type: 'varchar',
    length: 20,
  })
  status: EmployeeStatus;

  /** Inclusive start date of this status period (YYYY-MM-DD) */
  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  /** Inclusive end date; NULL means the status is still current */
  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
