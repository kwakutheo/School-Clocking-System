# Rate Limiting & Account Lockout Architecture

## 1. Executive Summary

This specification outlines the comprehensive rate-limiting and brute-force protection strategy across the School Clocking System:
- **Backend API** (`NestJS` + `TypeORM` + `PostgreSQL` in `/backend`)
- **Admin Dashboard** (Central Dashboard for Admins)
- **Mobile Clocking App** (`Flutter` in `/lib`)

The design resolves key constraints and realities of this specific software:
1. **Shared School Wi-Fi (NAT / Single Public IP):** Dozens or hundreds of employees and supervisors share the same public IP address on campus.
2. **Identifier Flexibility (No Mandatory Phone/Email for Employees):** 
   - Normal `employee` and `supervisor` accounts are not required to provide phone numbers or emails. They log in primarily using their **Username**.
   - `hr_admin` and `super_admin` accounts have phone numbers and emails registered in the system.
   - The login endpoint accepts an identifier that resolves against `username`, `phone`, or `email`.
3. **Time-Sensitive Operations:** Morning clock-in cannot afford to have legitimate staff locked out indefinitely due to network-wide IP bans.

---

## 2. Real-World Constraints & Core Architectural Principles

### Constraint A: Shared School Wi-Fi (NAT Network)
All devices connected to the campus Wi-Fi present the **exact same public IP address** to the backend API.
* **Why naive IP throttling fails:** If rate limiting is enforced solely by IP address (e.g., `5 requests per 15 min per IP`), one employee mistyping their password 5 times would block the entire school Wi-Fi, preventing all other employees from clocking in.
* **The Solution:** A **Dual-Tier Model**:
  - **Tier 1 (Volumetric Guard):** High-threshold IP rate limiting (e.g., 100 requests/minute per IP) to prevent massive bot flooding and DDoS attacks.
  - **Tier 2 (Account Lockout):** Tracked per **User Account** in the database (`User.id`), ensuring only the offending account is temporarily restricted.

### Constraint B: Login Identifiers in this Software
In `school_clocking_system`, the backend resolves authentication via:
```typescript
'TRIM(user.username) = :id OR TRIM(user.email) = :id OR TRIM(user.phone) = :id'
```
* **The Solution:** 
  - Rate limiting and lockout counters cannot be keyed purely on an email or phone string, because standard employees often use just a `username`.
  - Lockout state is anchored to the internal **`User.id` (UUID)** once resolved in the database.
  - For non-existent accounts (targeted guessing), tracking is handled via an in-memory / cache composite key: `throttle:unknown:${ip}:${normalizedIdentifier}`.

---

## 3. Dual-Tier Defense Architecture

```mermaid
flowchart TD
    Req[Incoming POST /auth/login] --> T1{Tier 1: IP Throttler<br/>> 100 req/min per IP?}
    T1 -- Yes --> R429_IP[Return HTTP 429: Too Many Requests from this network]
    T1 -- No --> Lookup[Resolve User by Identifier<br/>Username / Phone / Email]
    
    Lookup --> UserFound{User exists?}
    
    UserFound -- No --> TUnknown{> 5 failures for<br/>IP + Identifier in 15m?}
    TUnknown -- Yes --> R429_Unknown[Return HTTP 429: Too many attempts]
    TUnknown -- No --> RecordUnknown[Record unknown attempt in cache] --> R401_Invalid[Return HTTP 401: Invalid credentials]
    
    UserFound -- Yes --> CheckLock{User lockUntil > now()?}
    CheckLock -- Yes --> R429_Account[Return HTTP 429 / 423:<br/>Account Locked with retryAfterSeconds]
    
    CheckLock -- No --> VerifyPwd{Password matches bcrypt?}
    VerifyPwd -- Yes --> ResetAttempts[Reset failedLoginAttempts = 0<br/>Clear lockUntil = null] --> IssueTokens[Return HTTP 200: JWT Tokens]
    
    VerifyPwd -- No --> IncAttempts[Increment failedLoginAttempts += 1]
    IncAttempts --> Exceeded{failedLoginAttempts >= 5?}
    Exceeded -- Yes --> SetLock[Set lockUntil = now + 15 min] --> R429_JustLocked[Return HTTP 429: Account locked for 15 minutes]
    Exceeded -- No --> R401_Remaining[Return HTTP 401: Invalid credentials<br/>Include attemptsRemaining: 5 - count]
```

---

## 4. Backend Implementation (`backend/src/...` — NestJS & TypeORM)

### 4.1 Database Migration (`user.entity.ts`)
Add lockout tracking fields to the `User` entity:

```typescript
@Entity('users')
export class User extends TenantBaseEntity {
  // ... existing fields ...

  @Column({ name: 'failed_login_attempts', type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ name: 'lock_until', type: 'timestamp', nullable: true })
  lockUntil: Date | null;

  @Column({ name: 'last_failed_at', type: 'timestamp', nullable: true })
  lastFailedAt: Date | null;
}
```

### 4.2 Auth Resolution & Verification (`auth.service.ts`)
Update `validateUser` to integrate account lockout:

```typescript
async validateUser(identifier: string, password: string, context?: string): Promise<User | null> {
  const user = await this.users.findByIdentifier(identifier?.trim());
  if (!user) {
    // Optionally track IP+identifier in memory for unknown users
    return null;
  }

  // 1. Check Account Lockout
  if (user.lockUntil && user.lockUntil > new Date()) {
    const remainingSeconds = Math.ceil((user.lockUntil.getTime() - Date.now()) / 1000);
    throw new HttpException({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      error: 'Too Many Requests',
      code: 'ACCOUNT_LOCKED',
      message: `Account temporarily locked due to consecutive failed attempts. Please try again in ${Math.ceil(remainingSeconds / 60)} minutes.`,
      retryAfterSeconds: remainingSeconds,
    }, HttpStatus.TOO_MANY_REQUESTS);
  }

  // 2. Verify Password
  const matches = await bcrypt.compare(password?.trim(), user.passwordHash);

  if (!matches) {
    const updatedAttempts = user.failedLoginAttempts + 1;
    const maxAttempts = 5;
    const isNowLocked = updatedAttempts >= maxAttempts;
    const lockUntil = isNowLocked ? new Date(Date.now() + 15 * 60 * 1000) : null;

    await this.users.update(user.id, {
      failedLoginAttempts: updatedAttempts,
      lockUntil: lockUntil,
      lastFailedAt: new Date(),
    });

    if (isNowLocked) {
      throw new HttpException({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        code: 'ACCOUNT_LOCKED',
        message: 'Account locked due to 5 failed attempts. Please wait 15 minutes or contact your HR Admin.',
        retryAfterSeconds: 900,
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    throw new HttpException({
      statusCode: HttpStatus.UNAUTHORIZED,
      message: 'Invalid credentials.',
      attemptsRemaining: maxAttempts - updatedAttempts,
    }, HttpStatus.UNAUTHORIZED);
  }

  // 3. Successful Login: Reset Counters
  if (user.failedLoginAttempts > 0 || user.lockUntil) {
    await this.users.update(user.id, {
      failedLoginAttempts: 0,
      lockUntil: null,
    });
  }

  // ... proceed with tenant checks ...
  return user;
}
```

### 4.3 Emergency Admin Unlock Endpoint
Since regular `employee` accounts cannot use the `requestPasswordReset` flow (which requires an email and is restricted to `super_admin`, `hr_admin`, and `supervisor`), they must rely on an admin to unlock them if they get locked out during clock-in.

* **Endpoint:** `POST /users/:id/unlock`
* **Access Control:** `SUPER_ADMIN`, `HR_ADMIN`
* **Implementation:** Instantly resets `failedLoginAttempts = 0` and `lockUntil = null`.

---

## 5. Mobile App Implementation (`lib/` — Flutter)

Employees interact directly with the mobile app. The UX must provide clear warnings and rapid recovery paths.

### 5.1 Network Exception Mapping (`network_exception.dart`)
Detect HTTP 429 and `ACCOUNT_LOCKED`:
```dart
class AccountLockedException extends NetworkException {
  const AccountLockedException({
    required super.message,
    required this.retryAfter,
  });
  final Duration retryAfter;
}
```

### 5.2 Login Screen UX (`login_page.dart`)
1. **Warning on Approaching Lockout (Attempts 3 & 4):**
   * If the response includes `attemptsRemaining`, display an amber warning badge below the password field:
     *"⚠️ 2 attempts remaining before temporary lockout."*
2. **Locked State UX (Attempt 5):**
   * Disable the "Sign In" button.
   * Display a live countdown timer: `[ 🔒 Account Locked — Try again in 14:48 ]`
   * Show a prominent emergency button: **"Contact Support" / "Contact School Admin"**
   * This button directly uses the phone numbers of the `hr_admin` / `super_admin` registered in the system to initiate a Call or WhatsApp (as designed for the `faq_bottom_sheet` / support feature).
3. **Automatic Unlock:**
   * When the countdown reaches `00:00`, re-enable the "Sign In" button automatically.

---

## 6. Admin Dashboard Implementation

### 6.1 Admin Login Page
* Handles HTTP 429 with a countdown timer.
* Provides a direct link to the Self-Service Password Reset PIN flow (available for `hr_admin` and `super_admin`).

### 6.2 Employee Directory
1. **Account Status Indicator:**
   * Badges in the table: `Active`, `Inactive`, `Suspended`, and `Locked (Rate Limited)`.
2. **One-Click Unlock Action:**
   * For any locked user, an **"Unlock Account"** button is displayed.
   * Clicking the button sends `POST /users/:id/unlock`.
   * The employee can immediately clock in without waiting for the 15-minute timer.
