import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

@Entity('holidays')
export class Holiday extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ default: true })
  isRecurring: boolean; // If true, repeats every year on same date

  @Column({ default: false })
  postponeIfWeekend: boolean; // If true, weekend holidays shift to Monday

  @Column({ type: 'date', nullable: true })
  observedDate: string | null; // Custom overriding observed date (YYYY-MM-DD)

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
