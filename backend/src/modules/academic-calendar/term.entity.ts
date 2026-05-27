import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { TermBreak } from './term-break.entity';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

@Entity('academic_terms')
export class AcademicTerm extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // e.g., Term 1

  @Column()
  academicYear: string; // e.g., 2023/2024

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => TermBreak, breakItem => breakItem.term)
  breaks: TermBreak[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
