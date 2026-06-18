# Device-Based Attendance Restriction Implementation Plan

## Overview
Add a security feature that restricts each physical device (identified by `deviceId`) to be used for attendance clocking for only one employee per calendar day.

## Requirements
1. **Restriction**: One device can be used for any clocking action (in/out/break) only once per day, for any employee
2. **Exemption**: Admin manual clocking is fully exempt from this rule
3. **Error Message**: Clear, user‑friendly explanation of the restriction

## Pre-Existing Infrastructure (Great News!)
- ✅ `RecordAttendanceDto` already includes `deviceId` field
- ✅ `attendance_logs` table already has `device_id` column
- ✅ Mobile app already generates and sends `deviceId`

## Implementation Steps

### 1. Add Device Restriction Helper Method
Add a private method to `AttendanceService` that checks if a device has already been used today:
- File: `backend/src/modules/attendance/attendance.service.ts`
- Method name: `_checkDeviceUsageRestriction`
- Parameters: `deviceId: string | undefined, now: Date`
- Returns: `void` (throws `BadRequestException` if restricted)
- Logic:
  - If `deviceId` is `null`/`undefined` → skip (for backward compatibility/edge cases)
  - Query `attendance_logs` for any log with same `deviceId` and `timestamp` in today's range
  - If any log exists → throw error with clear message
  - Tenant scoped (uses existing multi‑tenant setup)

### 2. Apply Check to All Non-Admin Clocking Methods
Add the restriction check to:
- `record()` method (normal clock‑in/out/break via GPS)
- `recordViaQr()` method (QR code clocking)
- `syncOffline()` method (offline sync)
- Skip the check entirely for `adminManualClock()` method

### 3. Error Message
Use this user‑friendly error:
> "This device has already been used to record attendance today. Each phone may only be used for one person's attendance per day. Please use your own or another device or contact your administrator if you need assistance."

## Files to Modify
1. `backend/src/modules/attendance/attendance.service.ts` (only file needed)

## Testing Plan
1. Normal flow: Employee A clocks in on Device X → success
2. Restriction flow: Employee A logs out, Employee B logs in on Device X, tries to clock in → error thrown
3. Exemption flow: Admin manually clocks in Employee B on Device X → success
4. Reset check: Next calendar day, restriction resets, Device X can be used again

## Notes
- Uses existing TypeORM repository and multi‑tenant filtering
- Backward compatible: if `deviceId` is not provided, restriction is skipped
- No DB migrations needed (column already exists!)
