# Privacy Policy & Location Notice

**Application**: School Clocking System  
**Version**: 1.0.0  
**Last Updated**: September 4, 2026  

---

### 1. Overview & Purpose
The School Clocking System is an official staff attendance and shift management application designed exclusively for school staff and administrators. Our primary objective is to verify attendance punctuality and facilitate duty scheduling while upholding the highest standards of data security and personal privacy.

---

### 2. Location Data & Geofence Verification
* **Point-in-Time Capture**: High-precision location (GPS) is accessed solely at the precise moment you perform a clocking event (Clock In, Clock Out, Break Start, or Break End).
* **No 24/7 Background Tracking**: The app does **NOT** track, monitor, or record your physical movements throughout the day, nor does it access location services outside active clocking requests.
* **Geofence Verification**: Coordinates are compared against the school branch's designated geographic radius to confirm your physical presence on campus.
* **Dual Verification for QR Clocking**: To prevent anti-fraud risks (such as photocopying or remotely sharing QR codes), scanning the physical School Clocking QR code also verifies and requires an active GPS position within the school geofence.
* **Permission Control**: Location permission is requested at runtime. You can revoke location access in your device settings at any time; however, location access is required for all clocking actions to verify on-campus attendance.

---

### 3. Biometrics & Authentication
* **Device-Level Security**: When biometric login (Fingerprint or Face Unlock) is enabled, verification is executed entirely on your local device via Android's secure hardware-backed BiometricPrompt.
* **No Biometric Transmission**: Your biological biometric features (fingerprint data or facial geometry) are never accessed, captured, stored, or transmitted by this application or sent to school servers.
* **Offline Credentials**: A cryptographically secure hash of your login credentials is encrypted and stored locally in private application sandbox storage to support offline login when internet connectivity is lost.

---

### 4. Information We Collect
We collect and process only the minimal information necessary for school attendance administration:
* **User Profile**: Staff identification number, full name, email address, role, and assigned school branch.
* **Attendance Logs**: Timestamps of clock-in, clock-out, and break intervals, punctuality status, and clocking method (GPS Geofence or QR Scan).
* **Device Diagnostics**: Device model, Android OS version, and network connectivity state to ensure device authorization and prevent clock tampering.
* **Time Synchronization Data**: Network Time Protocol (NTP) integrity timestamps to ensure device clocks reflect verified true time.

---

### 5. Offline Storage & Data Protection
* **Encrypted Local Database**: When working without an active internet connection, attendance events are queued in a local SQLite database protected by application sandboxing.
* **Background Synchronization**: Pending records are encrypted during transit using standard TLS/HTTPS protocols and uploaded to the school's central database as soon as network connectivity is restored.
* **Data Wipe Option**: Users can clear offline stored data and credentials at any time from the app's Settings menu.

---

### 6. Data Usage & Third-Party Disclosure
* **Strictly Internal Use**: Your attendance data is utilized solely by authorized school administrators, department heads, and HR personnel for attendance records and duty management.
* **No Advertising or Data Selling**: We do not integrate commercial third-party tracking libraries, advertising networks, or data brokers. Your personal information and location logs are never sold or rented.

---

### 7. Access to Your Records
* Staff members have full access to view their own attendance logs and historical shift records via the 'My Report' and 'Calendar' sections of the application.
* If you notice an error in your logged hours or require adjustments due to forgotten clock-outs or technical issues, you may submit a correction request to your school administrator.

---

### 8. Contact & Inquiries
If you have questions, concerns, or requests regarding this Privacy Policy or your data usage, please contact:
* Your School Administrative Office or Head of Department
* School IT Support Desk
* Direct support contact details are accessible in the Settings section of the app.
