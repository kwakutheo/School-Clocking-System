Ran command: `dir /s /b *attendance.service.ts`
Listed directory src
Listed directory attendance
Viewed attendance.service.ts:1-800
Viewed attendance.service.ts:801-1128

I've gone through the `AttendanceService` (the heart of the clocking logic). Here is a breakdown of the rules **already implemented** and how we can add your new ideas:

### 🛡️ Existing Rules (Already in the System)

1.  **Non-Working Day Guard:** No clocking is allowed on Weekends, Public Holidays, Academic Breaks, or Vacations.
2.  **Shift Assignment Guard:** You cannot clock in if HR hasn't assigned you a specific work shift.
3.  **The "One-Way" State Machine:**
    - You can only **Clock In** once per day.
    - You must **Clock In** before you can **Clock Out** or take a **Break**.
    - You cannot **Clock Out** if you are currently on a **Break**.
4.  **Geofencing:** You must be within the allowed radius of your assigned branch (e.g., 200m) or the system blocks the action.
5.  **Strict Shift Hours:** Regular employees are currently **blocked** from Clocking In or taking Breaks if they are outside their shift hours (e.g., if their shift is 8 AM - 5 PM, they can't clock in at 7 AM or 6 PM).
6.  **Early Out Warning:** If an employee tries to clock out before the shift ends, the system gives a warning but allows them to "Force" it if they have a reason.
7.  **Admin Override:** Admins can clock in for others, and it bypasses the GPS check, but it currently lacks strict time-window enforcement.

---

### 🚀 What we can add (Your New Rules)

Based on our conversation, here is how we can upgrade these rules:

#### 1. The "2-Hour Pre-Shift" Window

- **Current Rule:** You can only clock in exactly when the shift starts.
- **New Rule:** We allow the "Clock In" button to become active **2 hours before** the shift starts (matching your countdown banner). Any earlier than 2 hours, and the system blocks it.

#### 2. The "Post-Shift" Lockout (with exceptions)

- **Current Rule:** Clock In is blocked after shift end.
- **New Rule:**
  - **Clock In / Break:** Hard block after shift ends.
  - **Clock Out:** Remains allowed **only if** they were already clocked in (to fix a "forgot to clock out" situation).

#### 3. Smart Admin Correction

- **Current Rule:** Admins can pick any time when doing a manual clock.
- **New Rule:** If an Admin is doing a manual clock after the shift has ended, the system will **force** them to select a time that falls **within** that employee's shift hours.

#### 4. The "Non-Working Day" Consistency

- Ensuring that even if an Admin tries to manually clock someone, the system still checks if it's a working day (unless it's an "emergency override").

**Which of these would you like me to implement first?** I suggest starting with the **Admin Manual Clock validation** since we were just looking at that modal!
