import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';
import { tenantLocalStorage } from './tenant.context';

@Injectable()
@EventSubscriber()
export class TenantSubscriber implements EntitySubscriberInterface {
  constructor(@InjectConnection() connection: Connection) {
    connection.subscribers.push(this);
  }

  beforeInsert(event: InsertEvent<any>) {
    const tenantId = tenantLocalStorage.getStore();
    if (tenantId) {
      // Use metadata to check if the entity natively supports tenantId
      const hasTenantId = event.metadata.columns.some(col => col.propertyName === 'tenantId');
      if (hasTenantId) {
        event.entity.tenantId = tenantId;
      }
    }
  }
}
