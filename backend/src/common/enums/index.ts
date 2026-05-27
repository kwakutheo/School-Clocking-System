export enum UserRole {
  EMPLOYEE = 'employee',
  SUPERVISOR = 'supervisor',
  HR_ADMIN = 'hr_admin',
  SUPER_ADMIN = 'super_admin',
}

export enum AttendanceType {
  CLOCK_IN = 'clock_in',
  CLOCK_OUT = 'clock_out',
  BREAK_IN = 'break_in',
  BREAK_OUT = 'break_out',
}

export enum EmployeeStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum LeaveType {
  SICK = 'SICK',
  ANNUAL = 'ANNUAL',
  CASUAL = 'CASUAL',
  MATERNITY = 'MATERNITY',
  PATERNITY = 'PATERNITY',
  OTHER = 'OTHER',
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}
