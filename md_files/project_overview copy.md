**Flutter for mobile + NestJS backend + Next.js admin dashboard + VS Code monorepo workflow + Ghana-focused constraints (offline, GPS, low infrastructure variability).**


# Workforce Time & Attendance System (Ghana-Ready SaaS Architecture)

A production-grade workforce management platform designed for organizations operating in Ghana and similar environments where **field work, branch distribution, and unreliable connectivity** are common.

The system is built as a modular SaaS product with a clean separation of concerns:

* Flutter mobile client (employees)
* Next.js admin dashboard (HR & management)
* NestJS backend API (core business engine)
* PostgreSQL database (single source of truth)

---

# 1. System Overview

The platform is designed as a distributed client-server system.

## Core Design Principle

> All applications are independent clients connected to a single backend API.

```text id="sys_arch_01"
Flutter Mobile App ───┐
                      │
Next.js Dashboard ────┼── NestJS API ─── PostgreSQL
                      │
Future Desktop App ───┘
```

Backend is the authoritative system for all logic, validation, and data integrity.

---

# 2. Frontend Applications

## A. Employee Mobile App (Flutter)

Built using Flutter

Primary use: field and office workers.

### Key Features

* Clock In / Clock Out
* Break tracking
* Attendance history
* Offline-first attendance capture
* GPS-based validation
* Selfie verification
* Push notifications

### Ghana-specific design requirement

* Works in low bandwidth environments
* Stores data offline and syncs later
* Minimal data consumption mode

---

## B. Admin / HR Dashboard (Next.js)

Built using Next.js

Primary use: HR teams, supervisors, and executives.

### Key Features

* Employee management
* Department and branch control
* Live attendance monitoring
* Shift planning
* Export to Excel/PDF
* Analytics dashboard

### Design focus

* Large dataset handling (tables, filters, reports)
* Fast querying and pagination
* Role-based access control views

---

# 3. Backend System (Core Engine)

Built using NestJS

This is the **brain of the entire system**.

## Responsibilities

### Authentication & Authorization

* JWT-based authentication
* Role-based access control (RBAC)
* Session/device validation

### Attendance Engine

* Clock-in/out validation
* GPS geofencing checks
* Duplicate punch prevention
* Offline sync reconciliation

### Notification System

* Push notifications
* Email/SMS integration (optional)

---

# 4. Database Layer

Built on PostgreSQL

Single source of truth for all system data.

---

## 4.1 Core Tables

### users

Stores authentication and identity.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    password_hash TEXT,
    role VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);
```

---

### employees

Business-level employee profile.

```sql
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    employee_code TEXT UNIQUE NOT NULL,
    department_id UUID,
    branch_id UUID,
    position TEXT,
    salary NUMERIC(12,2),
    hire_date DATE,
    photo_url TEXT,
    status VARCHAR(20) DEFAULT 'active'
);
```

---

### branches

Critical for Ghana’s multi-location businesses.

```sql
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    latitude NUMERIC(10,8),
    longitude NUMERIC(11,8),
    allowed_radius INT DEFAULT 100
);
```

---

### departments

```sql
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL
);
```

---

### shifts

```sql
CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_minutes INT DEFAULT 10
);
```

---

### attendance_logs

Central operational table.

```sql
CREATE TABLE attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    branch_id UUID REFERENCES branches(id),
    type VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    selfie_url TEXT,
    device_id TEXT,
    sync_status BOOLEAN DEFAULT TRUE
);
```

Types:

* clock_in
* clock_out
* break_in
* break_out

---

### leave_requests

```sql
CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    leave_type VARCHAR(20),
    start_date DATE,
    end_date DATE,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    approved_by UUID REFERENCES users(id)
);
```

---

### payroll_records

```sql
CREATE TABLE payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id),
    month INT,
    year INT,
    total_hours NUMERIC(10,2),
    overtime_hours NUMERIC(10,2),
    deductions NUMERIC(10,2),
    net_salary NUMERIC(12,2)
);
```

---

# 5. API Layer (NestJS)

Example endpoints:

```text
POST /auth/login
POST /auth/register

POST /attendance/clock-in
POST /attendance/clock-out
POST /attendance/break-start
POST /attendance/break-end

GET /attendance/history
GET /attendance/live

POST /leave/request
PUT /leave/approve

GET /employees
POST /employees

GET /payroll/export
```

---

# 6. Security Architecture

## Core security model

* JWT authentication
* RBAC (Role-Based Access Control)
* Row-level authorization logic in backend
* Device binding for mobile sessions
* Encrypted storage for sensitive data

## Data protection

* Selfie images encrypted at rest
* API rate limiting
* Audit logging for all critical actions

---

# 7. Offline-First Ghana Optimization

This system is explicitly designed for:

* unstable internet zones
* rural field operations
* plantation environments

## Offline capability (Flutter)

* cache attendance locally
* sync when network is restored
* conflict resolution handled in backend

---

# 8. Advanced Features (Scalable Roadmap)

## Geofencing Engine

Ensures attendance is only valid within branch radius.

## Face Verification (Optional Upgrade)

Biometric validation layer for fraud prevention.

## Real-Time Dashboard

Live attendance tracking for supervisors.

## Payroll Automation

Full monthly payroll computation pipeline.

---

# 9. Development Environment

Single workspace using Visual Studio Code:

```text
timeclock-system/
├── mobile_app/        (Flutter)
├── backend/           (NestJS)
├── admin_dashboard/   (Next.js)
└── database/
```

Each service runs independently but shares the same backend.

---

# 10. Commercial Strategy (Ghana Market Fit)

Target sectors:

* schools
* churches
* plantations
* SMEs
* logistics companies
* factories
* NGOs

Pricing model:

* Starter (small teams)
* Business (mid-size orgs)
* Enterprise (multi-branch systems)

---

# Final Note

This architecture is already at **real SaaS level design**. The key decision you’ve made (Flutter + NestJS + Next.js) is strong and scalable.

If you want next step, I can design:

* full NestJS module structure (auth, attendance, payroll, leave)
* or Flutter app folder architecture with state management
* or actual database relationships diagram (ERD style)
