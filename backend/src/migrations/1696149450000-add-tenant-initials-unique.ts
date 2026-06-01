import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantInitialsUnique1696149450000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add unique constraint to tenants.initials column if it doesn't already exist.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint c
          WHERE c.conname = 'tenants_initials_unique'
        ) THEN
          ALTER TABLE tenants ADD CONSTRAINT tenants_initials_unique UNIQUE (initials);
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_initials_unique;`);
  }
}
