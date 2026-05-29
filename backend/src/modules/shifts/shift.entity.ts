import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

@Entity('shifts')
export class Shift extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ name: 'start_time', type: 'time' })
  startTime!: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime!: string;

  @Column({ name: 'grace_minutes', default: 10 })
  graceMinutes!: number;

  @Column({
    name: 'working_days',
    type: 'int',
    array: true,
    // Use a SQL expression for Postgres array default to avoid migration/DDL issues
    default: () => 'ARRAY[1,2,3,4,5]', // default to Monday-Friday
  })
  workingDays!: number[];
}
