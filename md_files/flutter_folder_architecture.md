Below is a **production-grade Flutter folder architecture** tailored for your time & attendance system, designed to work cleanly with a NestJS backend and scale into a SaaS product.

It uses a **feature-first + clean architecture hybrid**, which is what most serious Flutter codebases converge to in real systems.

Built for Flutter with explicit support for state management.

---

# 1. Recommended State Management Choice

For your system (attendance, GPS, offline sync, payroll views), the best fit is:

### Option A (Recommended)

* flutter_bloc

Why:

* predictable state flow
* good for enterprise apps
* easy testing
* scalable for complex modules like payroll & attendance

---

# 2. High-Level Folder Structure

```text id="fl_root_01"
lib/
│
├── main.dart
├── app.dart
│
├── core/
│   ├── config/
│   ├── constants/
│   ├── errors/
│   ├── network/
│   ├── services/
│   ├── utils/
│   └── theme/
│
├── shared/
│   ├── widgets/
│   ├── models/
│   ├── enums/
│   └── extensions/
│
├── features/
│   ├── auth/
│   ├── attendance/
│   ├── employee/
│   ├── leave/
│   ├── payroll/
│   ├── shift/
│   ├── dashboard/
│   └── notifications/
│
└── injection_container.dart
```

---

# 3. Feature-Based Architecture (Core Idea)

Each feature is self-contained:

```text id="fl_feature_01"
feature/
├── data/
├── domain/
├── presentation/
```

This prevents spaghetti code as the app grows.

---

# 4. Example: ATTENDANCE MODULE

This is your most important module.

```text id="fl_att_01"
attendance/
│
├── data/
│   ├── datasources/
│   │   ├── attendance_remote_data_source.dart
│   │   ├── attendance_local_data_source.dart
│   │
│   ├── models/
│   │   ├── attendance_model.dart
│   │
│   ├── repositories/
│       ├── attendance_repository_impl.dart
│
├── domain/
│   ├── entities/
│   │   ├── attendance.dart
│   │
│   ├── repositories/
│   │   ├── attendance_repository.dart
│   │
│   ├── usecases/
│       ├── clock_in.dart
│       ├── clock_out.dart
│       ├── get_attendance_history.dart
│
├── presentation/
│   ├── bloc/
│   │   ├── attendance_bloc.dart
│   │   ├── attendance_event.dart
│   │   ├── attendance_state.dart
│   │
│   ├── pages/
│   │   ├── clock_in_page.dart
│   │   ├── history_page.dart
│   │
│   ├── widgets/
│       ├── clock_button.dart
│       ├── attendance_card.dart
```

---

# 5. AUTH MODULE

```text id="fl_auth_01"
auth/
│
├── data/
│   ├── models/
│   ├── repositories/
│
├── domain/
│   ├── entities/
│   ├── usecases/
│
├── presentation/
│   ├── bloc/
│   ├── pages/
│       ├── login_page.dart
│       ├── register_page.dart
```

Handles:

* login
* JWT token storage
* role-based routing

---

# 6. PAYROLL MODULE

```text id="fl_pay_01"
payroll/
│
├── data/
├── domain/
│   ├── entities/
│   ├── usecases/
│       ├── get_monthly_payroll.dart
│
├── presentation/
│   ├── bloc/
│   ├── pages/
│       ├── payroll_summary_page.dart
```

Displays:

* salary breakdown
* overtime
* deductions

---

# 7. LEAVE MODULE

```text id="fl_leave_01"
leave/
│
├── data/
├── domain/
│   ├── usecases/
│       ├── request_leave.dart
│       ├── approve_leave.dart
│
├── presentation/
│   ├── bloc/
│   ├── pages/
│       ├── leave_request_page.dart
│       ├── leave_history_page.dart
```

---

# 8. CORE LAYER (Very Important)

```text id="fl_core_01"
core/
│
├── network/
│   ├── api_client.dart
│   ├── api_endpoints.dart
│
├── services/
│   ├── location_service.dart
│   ├── storage_service.dart
│   ├── sync_service.dart
│
├── utils/
│   ├── validators.dart
│   ├── date_utils.dart
│
├── constants/
│   ├── app_constants.dart
│
├── theme/
│   ├── app_theme.dart
```

---

# 9. SHARED LAYER

Reusable UI components:

```text id="fl_shared_01"
shared/
├── widgets/
│   ├── primary_button.dart
│   ├── loading_indicator.dart
│   ├── custom_app_bar.dart
│
├── models/
│   ├── user_model.dart
│
├── enums/
│   ├── attendance_type.dart
```

---

# 10. DEPENDENCY INJECTION

```text id="fl_di_01"
injection_container.dart
```

Handles:

* API clients
* repositories
* blocs
* services

Usually built using `get_it`.

---

# 11. STATE FLOW (HOW EVERYTHING CONNECTS)

Example Clock-In Flow:

```text id="fl_flow_01"
UI Button
   ↓
AttendanceBloc (event: ClockIn)
   ↓
UseCase (ClockIn)
   ↓
Repository
   ↓
Remote Data Source (NestJS API)
   ↓
PostgreSQL (backend storage)
   ↓
Response → Bloc State → UI Update
```

---

# 12. OFFLINE-FIRST DESIGN (IMPORTANT FOR GHANA)

Inside `attendance_local_data_source.dart`:

* store clock-in locally (Hive / SQLite)
* mark as “pending sync”
* background sync when network returns

This is critical for:

* plantations
* rural schools
* field staff in Ghana

---

# 13. WHY THIS STRUCTURE WORKS FOR YOU

This architecture is designed for:

* scaling into SaaS
* clean separation of business logic
* easy backend switching (NestJS API already planned)
* offline-first Ghana usage
* long-term maintainability

---

# FINAL NOTE

If you build using this structure, your system is already at **commercial SaaS level architecture**, not a hobby app.

