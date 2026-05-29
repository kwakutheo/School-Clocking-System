import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum BulletinType {
  INFO = 'info',
  WARNING = 'warning',
  SUCCESS = 'success',
  MAINTENANCE = 'maintenance',
}

@Index('idx_system_bulletins_active', ['isActive'], {
  where: '"is_active" = true',
})
@Index('idx_system_bulletins_created_at', ['createdAt'])
@Entity('system_bulletins')
export class SystemBulletin {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column('text')
  content!: string;

  @Column({
    type: 'enum',
    enum: BulletinType,
    default: BulletinType.INFO,
  })
  type!: BulletinType;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  /**
   * Optional list of tenant IDs this bulletin is scoped to.
   * NULL or empty means the bulletin is broadcast to ALL schools.
   * When populated, only the listed tenant IDs will receive this bulletin.
   */
  @Column({ name: 'target_tenant_ids', type: 'simple-array', nullable: true })
  targetTenantIds!: string[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
