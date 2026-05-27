import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { AcademicTerm } from './term.entity';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

@Entity('term_breaks')
export class TermBreak extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // e.g., Mid-term break

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @ManyToOne(() => AcademicTerm, term => term.breaks, { onDelete: 'CASCADE' })
  term: AcademicTerm;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
