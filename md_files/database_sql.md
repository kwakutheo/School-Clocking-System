-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.tenants (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  slug character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  logo_url character varying,
  primary_color character varying NOT NULL DEFAULT '#3b82f6'::character varying,
  custom_domain character varying UNIQUE,
  initials character varying UNIQUE,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  last_employee_serial integer NOT NULL DEFAULT 0,
  CONSTRAINT tenants_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  tenant_id uuid,
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  full_name character varying NOT NULL,
  email character varying UNIQUE,
  phone character varying UNIQUE,
  username character varying UNIQUE,
  password_hash character varying NOT NULL,
  role character varying NOT NULL DEFAULT 'employee'::character varying,
  is_active boolean NOT NULL DEFAULT true,
  requires_password_change boolean NOT NULL DEFAULT false,
  reset_pin character varying,
  fcm_token text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  last_login_at timestamp without time zone,
  mfa_enabled boolean NOT NULL DEFAULT false,
  deleted_at timestamp without time zone,
  reset_pin_expires_at timestamp without time zone,
  reset_pin_attempts integer NOT NULL DEFAULT 0,
  is_dashboard_blocked boolean NOT NULL DEFAULT false,
  dashboard_block_reason text,
  dashboard_blocked_at timestamp without time zone,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT FK_109638590074998bb72a2f2cf08 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.audit_logs (
  tenant_id uuid,
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  action character varying NOT NULL,
  module character varying NOT NULL,
  targetId character varying,
  oldValues jsonb,
  newValues jsonb,
  ipAddress character varying,
  userAgent character varying,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  user_id uuid,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT FK_6f18d459490bb48923b1f40bdb7 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT FK_bd2726fd31b35443f2245b93ba0 FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.departments (
  tenant_id uuid,
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  CONSTRAINT departments_pkey PRIMARY KEY (id),
  CONSTRAINT FK_146fd7019eea73f8ee7bbb52d4a FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.branches (
  tenant_id uuid,
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  latitude numeric,
  longitude numeric,
  allowed_radius integer NOT NULL DEFAULT 300,
  qr_code character varying,
  qr_code_updated_at timestamp without time zone,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT branches_pkey PRIMARY KEY (id),
  CONSTRAINT FK_fda619979f40a6a44fc9baf02c3 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.shifts (
  tenant_id uuid,
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  grace_minutes integer NOT NULL DEFAULT 10,
  working_days ARRAY NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5],
  CONSTRAINT shifts_pkey PRIMARY KEY (id),
  CONSTRAINT FK_90413bab4120ede23bb47168777 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.employees (
  tenant_id uuid,
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  employee_code character varying NOT NULL,
  position character varying,
  hire_date date,
  photo_url character varying,
  status character varying NOT NULL DEFAULT 'active'::character varying,
  status_change_date date,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  user_id uuid UNIQUE,
  department_id uuid,
  branch_id uuid,
  shift_id uuid,
  is_archived boolean NOT NULL DEFAULT false,
  CONSTRAINT employees_pkey PRIMARY KEY (id),
  CONSTRAINT FK_588d18aeef0504067e40c682788 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT FK_2d83c53c3e553a48dadb9722e38 FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT FK_678a3540f843823784b0fe4a4f2 FOREIGN KEY (department_id) REFERENCES public.departments(id),
  CONSTRAINT FK_457a39c666de2686596e502eb8c FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT FK_98e5075745ff16aeca79c12311c FOREIGN KEY (shift_id) REFERENCES public.shifts(id)
);
CREATE TABLE public.employee_status_logs (
  tenant_id uuid,
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL,
  status character varying NOT NULL,
  start_date date NOT NULL,
  end_date date,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT employee_status_logs_pkey PRIMARY KEY (id),
  CONSTRAINT FK_6137dcca4f048102b6915f23b13 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT FK_94d7ae99a2c70c1e5a09cacaf4e FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.settings (
  key character varying NOT NULL,
  value text NOT NULL,
  updatedAt timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT settings_pkey PRIMARY KEY (key)
);
CREATE TABLE public.attendance_logs (
  tenant_id uuid,
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  type character varying NOT NULL,
  timestamp timestamp with time zone NOT NULL,
  device_id character varying,
  latitude numeric,
  longitude numeric,
  selfie_url character varying,
  is_late boolean NOT NULL DEFAULT false,
  is_offline_sync boolean NOT NULL DEFAULT false,
  is_admin_override boolean NOT NULL DEFAULT false,
  admin_note character varying,
  admin_override_name character varying,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  employee_id uuid,
  branch_id uuid,
  is_excused_late boolean NOT NULL DEFAULT false,
  excuse_reason text,
  is_early_out boolean NOT NULL DEFAULT false,
  is_excused_early_out boolean NOT NULL DEFAULT false,
  excuse_early_out_reason text,
  excused_by_id uuid,
  early_out_excused_by_id uuid,
  scheduled_start_time character varying,
  scheduled_end_time character varying,
  scheduled_grace_minutes integer,
  late_minutes integer,
  early_out_minutes integer,
  CONSTRAINT attendance_logs_pkey PRIMARY KEY (id),
  CONSTRAINT FK_9686734a4d3009a0d5e9f1515ed FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT FK_c4ca4ff3d403535898ba7ae6ba3 FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT FK_88d62dea52c3a990addca04b063 FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT FK_139645d97c494e4869f56c89a39 FOREIGN KEY (excused_by_id) REFERENCES public.users(id),
  CONSTRAINT FK_c19cd82faff3b57f7f05e1210f3 FOREIGN KEY (early_out_excused_by_id) REFERENCES public.users(id)
);
CREATE TABLE public.attendance_daily_summaries (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  date date NOT NULL,
  expected_count integer NOT NULL DEFAULT 0,
  present_count integer NOT NULL DEFAULT 0,
  is_holiday boolean NOT NULL DEFAULT false,
  computed_at timestamp without time zone NOT NULL DEFAULT now(),
  leave_count integer NOT NULL DEFAULT 0,
  CONSTRAINT attendance_daily_summaries_pkey PRIMARY KEY (id)
);
CREATE TABLE public.holidays (
  tenant_id uuid,
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  date date NOT NULL,
  isRecurring boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  postponeIfWeekend boolean NOT NULL DEFAULT false,
  observedDate date,
  CONSTRAINT holidays_pkey PRIMARY KEY (id),
  CONSTRAINT FK_c54c400d1c627f5dc3bbb8c2b0a FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.term_breaks (
  tenant_id uuid,
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  startDate date NOT NULL,
  endDate date NOT NULL,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  termId uuid,
  CONSTRAINT term_breaks_pkey PRIMARY KEY (id),
  CONSTRAINT FK_6e1a4ca6c5dc5027fd424cb2fbb FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT FK_5d559d47d33eb349768bc91f097 FOREIGN KEY (termId) REFERENCES public.academic_terms(id)
);
CREATE TABLE public.academic_terms (
  tenant_id uuid,
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  academicYear character varying NOT NULL,
  startDate date NOT NULL,
  endDate date NOT NULL,
  isActive boolean NOT NULL DEFAULT true,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT academic_terms_pkey PRIMARY KEY (id),
  CONSTRAINT FK_15551e61d3327a57ca6fc3800f7 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);
CREATE TABLE public.leave_requests (
  tenant_id uuid,
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  leave_type character varying NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status character varying NOT NULL DEFAULT 'PENDING'::character varying,
  review_note text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  employee_id uuid,
  reviewed_by uuid,
  CONSTRAINT leave_requests_pkey PRIMARY KEY (id),
  CONSTRAINT FK_4c0727a131644d680e44c3d2aa8 FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT FK_52b4b7c7d295e204add6dbe0a09 FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT FK_2f7a4220ff516ce48bdd91ce23d FOREIGN KEY (reviewed_by) REFERENCES public.users(id)
);
CREATE TABLE public.system_bulletins (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title character varying NOT NULL,
  content text NOT NULL,
  type USER-DEFINED NOT NULL DEFAULT 'info'::system_bulletins_type_enum,
  is_active boolean NOT NULL DEFAULT true,
  target_tenant_ids text,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT system_bulletins_pkey PRIMARY KEY (id)
);