import {
  Entity, PrimaryGeneratedColumn, Column,
  Index, UpdateDateColumn,
} from 'typeorm';

/**
 * AttendanceDailySummary
 *
 * One row per (tenant, date). A nightly cron job (AttendanceSummaryJob) recomputes
 * these values for yesterday and the last rolling 90 days to correct for any
 * backdated status changes or admin overrides.
 *
 * This table is the SOLE source of truth for all SaaS-Admin attendance metrics.
 * Querying it is O(date range) rather than O(employees × days × log records).
 *
 * Columns
 * -------
 *  tenantId        – School UUID (matches tenants.id)
 *  date            – Calendar date in YYYY-MM-DD
 *  expectedCount   – Number of employee-working-day slots expected (respects status
 *                    history, hire date, shift working-days, and holidays)
 *  presentCount    – Distinct employees who clocked in on this date
 *  isHoliday       – True when this date was a global or school-specific holiday;
 *                    expectedCount will be 0 but the row is kept for auditability
 *  computedAt      – Last time this row was recomputed by the cron job
 */
@Entity('attendance_daily_summaries')
@Index(['tenantId', 'date'], { unique: true })
@Index(['date'])
export class AttendanceDailySummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  /** YYYY-MM-DD */
  @Column({ type: 'date' })
  date: string;

  /** How many employee-working-day slots were expected on this date */
  @Column({ name: 'expected_count', type: 'int', default: 0 })
  expectedCount: number;

  /** How many distinct employees actually clocked in on this date */
  @Column({ name: 'present_count', type: 'int', default: 0 })
  presentCount: number;

  /** True when the date was a holiday (global or school-specific) */
  @Column({ name: 'is_holiday', default: false })
  isHoliday: boolean;

  @UpdateDateColumn({ name: 'computed_at' })
  computedAt: Date;
}
