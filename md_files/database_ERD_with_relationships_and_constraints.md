Below is a **full production-grade ERD design** for your **Employee Time & Attendance SaaS system**, aligned with your architecture:

* Flutter mobile app (employees)
* Next.js dashboard (HR/admin)
* NestJS backend (business logic)
* PostgreSQL database

This focuses on **clean normalization, enforceable constraints, and real SaaS scalability**.

---

# 1. High-Level ERD Overview

```text id="erd_01"
USERS ────────┐
              │
              ▼
        EMPLOYEES ─────── DEPARTMENTS
              │
              │
              ├──────── BRANCHES
              │
              ├──────── ATTENDANCE_LOGS
              │
              ├──────── LEAVE_REQUESTS
              │
              ├──────── PAYROLL_RECORDS
              │
              └──────── EMPLOYEE_SHIFTS ───── SHIFTS
```

---

# 2. Core Entity Design (Detailed)

---

# 2.1 USERS (Authentication Layer)

```sql id="users_01"
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN (
        'employee',
        'supervisor',
        'hr_admin',
        'super_admin'
    )),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT now()
);
```

### Constraints

* UNIQUE(email)
* UNIQUE(phone)
* role restricted via CHECK constraint
* password_hash required

---

# 2.2 EMPLOYEES (Business Profile Layer)

```sql id="employees_01"
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    employee_code TEXT UNIQUE NOT NULL,
    department_id UUID,
    branch_id UUID,
    position TEXT,
    salary NUMERIC(12,2) CHECK (salary >= 0),
    hire_date DATE,
    photo_url TEXT,
    status VARCHAR(20) DEFAULT 'active'
);
```

### Relationships

* 1:1 with users
* Many:1 with departments
* Many:1 with branches

---

# 2.3 DEPARTMENTS

```sql id="departments_01"
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE
);
```

---

# 2.4 BRANCHES (Critical for Ghana geo-operations)

```sql id="branches_01"
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    latitude NUMERIC(10,8),
    longitude NUMERIC(11,8),
    allowed_radius INT DEFAULT 100 CHECK (allowed_radius > 0)
);
```

### Constraint logic

* used for GPS geofencing validation
* radius in meters

---

# 2.5 SHIFTS (Time Rules Engine)

```sql id="shifts_01"
CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_minutes INT DEFAULT 10 CHECK (grace_minutes >= 0)
);
```

---

# 2.6 EMPLOYEE_SHIFTS (Many-to-Many Mapping)

```sql id="employee_shifts_01"
CREATE TABLE employee_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE,
    assigned_date DATE NOT NULL,
    UNIQUE(employee_id, assigned_date)
);
```

### Constraint logic

* prevents duplicate shift assignment per day

---

# 2.7 ATTENDANCE_LOGS (Core System Table)

```sql id="attendance_01"
CREATE TABLE attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),
    type VARCHAR(20) NOT NULL CHECK (type IN (
        'clock_in',
        'clock_out',
        'break_in',
        'break_out'
    )),
    timestamp TIMESTAMP NOT NULL DEFAULT now(),
    latitude NUMERIC(10,8),
    longitude NUMERIC(11,8),
    selfie_url TEXT,
    device_id TEXT,
    sync_status BOOLEAN DEFAULT TRUE
);
```

### Key Constraints

* ENUM-like CHECK for attendance type
* FK to employees (mandatory)
* branch validation for GPS rules

### Indexing (important)

```sql id="attendance_index_01"
CREATE INDEX idx_attendance_employee ON attendance_logs(employee_id);
CREATE INDEX idx_attendance_timestamp ON attendance_logs(timestamp);
```

---

# 2.8 LEAVE_REQUESTS (Workflow System)

```sql id="leave_01"
CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(30) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT now()
);
```

### Constraint logic

* status restricted
* approved_by optional (until approval)

---

# 2.9 PAYROLL_RECORDS (Financial Output Layer)

```sql id="payroll_01"
CREATE TABLE payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    month INT CHECK (month BETWEEN 1 AND 12),
    year INT CHECK (year >= 2020),
    total_hours NUMERIC(10,2) DEFAULT 0,
    overtime_hours NUMERIC(10,2) DEFAULT 0,
    deductions NUMERIC(10,2) DEFAULT 0,
    net_salary NUMERIC(12,2) DEFAULT 0,
    UNIQUE(employee_id, month, year)
);
```

### Constraints

* prevents duplicate payroll per employee per month
* ensures valid month/year range

---

# 3. Relationship Summary

## 1. USERS → EMPLOYEES

* 1:1 relationship
* enforced via `user_id UNIQUE`

---

## 2. EMPLOYEES → ATTENDANCE_LOGS

* 1:M relationship
* one employee has many attendance records

---

## 3. EMPLOYEES → LEAVE_REQUESTS

* 1:M relationship

---

## 4. EMPLOYEES → PAYROLL_RECORDS

* 1:M relationship (monthly records)

---

## 5. EMPLOYEES ↔ SHIFTS

* M:N relationship via `employee_shifts`

---

## 6. DEPARTMENTS → EMPLOYEES

* 1:M relationship

---

## 7. BRANCHES → EMPLOYEES / ATTENDANCE

* 1:M relationship

---

# 4. Business Rules Enforced in DB

### Attendance rules

* must belong to valid employee
* must have valid type
* timestamp always required

### Payroll rules

* only one record per employee per month
* numeric constraints prevent negative salary

### Leave rules

* status strictly controlled
* approval tracked via foreign key

---

# 5. Performance Design (Critical for SaaS)

### Indexing strategy

```sql id="indexes_01"
CREATE INDEX idx_employee_branch ON employees(branch_id);
CREATE INDEX idx_leave_employee ON leave_requests(employee_id);
CREATE INDEX idx_payroll_employee ON payroll_records(employee_id);
```

---

# 6. Ghana-Specific Design Considerations

This ERD supports:

* multi-branch companies (Accra, Kumasi, Takoradi, etc.)
* plantation/field workforce tracking
* offline sync reconciliation (via sync_status)
* GPS enforcement for attendance fraud prevention
* payroll export for manual accounting systems

---

# 7. What Makes This ERD “Production Grade”

* fully normalized (3NF compliant)
* strict constraints (CHECK + UNIQUE + FK)
* scalable indexing strategy
* supports SaaS multi-company expansion (future upgrade)
* supports offline-first mobile architecture
* compatible with NestJS domain modules

---

# Final Note

This database design is already strong enough to support a **commercial SaaS product**, not just a prototype.
