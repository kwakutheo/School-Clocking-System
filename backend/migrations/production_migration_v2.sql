-- =====================================================================
-- TK Clocking System — Production Migration Script
-- Run this on your Render PostgreSQL database to restore full functionality.
-- =====================================================================

-- 1. Add the status_change_date column to employees (if it doesn't exist)
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS status_change_date DATE NULL;

-- 2. Create the employee_status_logs table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS employee_status_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status        VARCHAR(20)  NOT NULL,
  start_date    DATE         NOT NULL,
  end_date      DATE         NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  employee_id   UUID         NOT NULL REFERENCES employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_status_logs_employee ON employee_status_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_status_logs_dates    ON employee_status_logs(start_date, end_date);

-- 3. Create the leave_requests table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS leave_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_type   VARCHAR(20)  NOT NULL,
  start_date   DATE         NOT NULL,
  end_date     DATE         NOT NULL,
  reason       TEXT         NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
  review_note  TEXT         NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  employee_id  UUID         NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  reviewed_by  UUID         NULL     REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status   ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates    ON leave_requests(start_date, end_date);

-- =====================================================================
-- Done. Restart your Render backend after running this script.
-- =====================================================================
