import { Repository } from 'typeorm';
import { tenantLocalStorage } from './tenant.context';

export function patchTypeORMRepository() {
  const originalFind = Repository.prototype.find;
  const originalFindOne = Repository.prototype.findOne;
  const originalFindAndCount = Repository.prototype.findAndCount;
  const originalCount = Repository.prototype.count;

  const applyTenantFilter = (metadata: any, options: any, tenantId: string) => {
    // 1. Check if the entity has a tenantId column property
    const hasTenantId = metadata.columns.some(
      (col: any) => col.propertyName === 'tenantId',
    );
    if (!hasTenantId) return options;

    // Bypass User entity auto-filtering to allow loading global / super_admin profiles
    if (metadata.name === 'User') return options;

    options = options || {};

    // 2. If options.where already contains tenantId (including IsNull()), do not overwrite it!
    if (options.where) {
      if (Array.isArray(options.where)) {
        if (options.where.some((w: any) => 'tenantId' in w)) {
          console.log(
            `📌 [TypeORM Patch] Bypassed auto-inject for ${metadata.name} (explicit tenantId found in array where)`,
          );
          return options;
        }
      } else {
        if ('tenantId' in options.where) {
          console.log(
            `📌 [TypeORM Patch] Bypassed auto-inject for ${metadata.name} (explicit tenantId found in object where)`,
          );
          return options;
        }
      }
    }

    // 3. Safely handle where clause cases (Object, Array, or Undefined)
    if (Array.isArray(options.where)) {
      options.where = options.where.map((subWhere: any) => ({
        ...subWhere,
        tenantId,
      }));
    } else {
      options.where = {
        ...(options.where || {}),
        tenantId,
      };
    }

    console.log(
      `📌 [TypeORM Patch] Auto-injected tenantId filter for ${metadata.name}:`,
      options.where,
    );
    return options;
  };

  // 1. Intercept .find()
  Repository.prototype.find = function (options: any = {}) {
    const tenantId = tenantLocalStorage.getStore();
    const metadata = this.metadata;

    console.log(
      `🔍 [TypeORM Patch] Repository.find() called for ${metadata.name} | Active Tenant ID: ${tenantId}`,
    );

    if (tenantId) {
      options = applyTenantFilter(metadata, options, tenantId);
    }
    return originalFind.call(this, options);
  };

  // 2. Intercept .findOne()
  Repository.prototype.findOne = function (options: any = {}) {
    const tenantId = tenantLocalStorage.getStore();
    const metadata = this.metadata;

    console.log(
      `🔍 [TypeORM Patch] Repository.findOne() called for ${metadata.name} | Active Tenant ID: ${tenantId}`,
    );

    if (tenantId) {
      options = applyTenantFilter(metadata, options, tenantId);
    }
    return originalFindOne.call(this, options);
  };

  // 3. Intercept .findAndCount()
  Repository.prototype.findAndCount = function (options: any = {}) {
    const tenantId = tenantLocalStorage.getStore();
    const metadata = this.metadata;

    console.log(
      `🔍 [TypeORM Patch] Repository.findAndCount() called for ${metadata.name} | Active Tenant ID: ${tenantId}`,
    );

    if (tenantId) {
      options = applyTenantFilter(metadata, options, tenantId);
    }
    return originalFindAndCount.call(this, options);
  };

  // 4. Intercept .count()
  Repository.prototype.count = function (options: any = {}) {
    const tenantId = tenantLocalStorage.getStore();
    const metadata = this.metadata;

    console.log(
      `🔍 [TypeORM Patch] Repository.count() called for ${metadata.name} | Active Tenant ID: ${tenantId}`,
    );

    if (tenantId) {
      options = applyTenantFilter(metadata, options, tenantId);
    }
    return originalCount.call(this, options);
  };

  // 5. Intercept .createQueryBuilder()
  const originalCreateQueryBuilder = Repository.prototype.createQueryBuilder;
  Repository.prototype.createQueryBuilder = function (
    alias?: string,
    queryRunner?: any,
  ) {
    const tenantId = tenantLocalStorage.getStore();
    const metadata = this.metadata;
    const qb = originalCreateQueryBuilder.call(this, alias, queryRunner);

    const hasTenantId = metadata.columns.some(
      (col: any) => col.propertyName === 'tenantId',
    );
    if (tenantId && hasTenantId && alias && metadata.name !== 'User') {
      // Patch terminal execution methods instead of eagerly appending `.andWhere()`,
      // because if the developer later calls `.where()`, TypeORM will overwrite and delete the tenant scope.
      const injectTenant = () => {
        if (!qb.__tenantInjected) {
          // If the query contains any condition with "tenantId" or "tenant_id", do not overwrite it!
          const hasTenantCondition = qb.expressionMap.wheres.some(
            (w: any) =>
              w.condition &&
              (w.condition.includes('tenantId') ||
                w.condition.includes('tenant_id')),
          );

          if (!hasTenantCondition) {
            qb.andWhere(`${alias}.tenantId = :tenantId_auto`, {
              tenantId_auto: tenantId,
            });
            console.log(
              `📌 [TypeORM Patch] Auto-injected tenantId filter for queryBuilder on ${metadata.name} (alias: ${alias}): ${tenantId}`,
            );
          } else {
            console.log(
              `📌 [TypeORM Patch] Bypassed auto-inject for queryBuilder on ${metadata.name} (alias: ${alias}) due to explicit condition.`,
            );
          }
          qb.__tenantInjected = true;
        }
      };

      const originalGetMany = qb.getMany;
      qb.getMany = function () {
        injectTenant();
        return originalGetMany.call(this);
      };

      const originalGetOne = qb.getOne;
      qb.getOne = function () {
        injectTenant();
        return originalGetOne.call(this);
      };

      const originalGetCount = qb.getCount;
      qb.getCount = function () {
        injectTenant();
        return originalGetCount.call(this);
      };

      const originalGetManyAndCount = qb.getManyAndCount;
      qb.getManyAndCount = function () {
        injectTenant();
        return originalGetManyAndCount.call(this);
      };

      const originalGetRawMany = qb.getRawMany;
      qb.getRawMany = function () {
        injectTenant();
        return originalGetRawMany.call(this);
      };

      const originalGetRawOne = qb.getRawOne;
      qb.getRawOne = function () {
        injectTenant();
        return originalGetRawOne.call(this);
      };
    }

    return qb;
  };
}
