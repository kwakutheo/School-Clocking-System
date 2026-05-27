import { Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Tenant } from '../../modules/tenants/tenant.entity';

export abstract class TenantBaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  @Index()
  tenantId: string | null;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant | null;
}
