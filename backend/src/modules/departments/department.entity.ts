import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';
import { TenantBaseEntity } from '../../common/entities/tenant-base.entity';

@Entity('departments')
@Unique(['tenantId', 'name'])
export class Department extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;
}
