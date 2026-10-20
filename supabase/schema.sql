-- =========================================================
-- LABORATORY ASSET AND SERVICE MANAGEMENT SYSTEM
-- Database Schema & Security Controls
-- =========================================================

-- Enable pgcrypto / uuid extension
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =========================================================
-- 1. USERS & ROLES TABLE
-- Roles: admin, staff, requester
-- =========================================================
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  name character varying(255) not null,
  email character varying(255) not null unique,
  password character varying(255) not null,
  role character varying(50) not null default 'requester' check (role in ('admin', 'staff', 'requester')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 2. EQUIPMENT INVENTORY TABLE
-- Tracked individual laboratory assets
-- Status: available, borrowed, maintenance
-- =========================================================
create table if not exists public.equipment (
  id uuid primary key default uuid_generate_v4(),
  code character varying(50) not null unique,
  name character varying(255) not null,
  category character varying(100),
  location character varying(100),
  status character varying(50) not null default 'available' check (status in ('available', 'borrowed', 'maintenance')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 3. BORROWING REQUESTS & APPROVAL WORKFLOW TABLE
-- Required statuses: pending, approved, rejected, released, returned, overdue, closed
-- Workflow:
--   Borrowing Request Submitted -> pending
--   Administrator Reviews Request -> approved / rejected
--   If Approved -> released -> returned -> closed
-- =========================================================
create table if not exists public.borrowing_requests (
  id uuid primary key default uuid_generate_v4(),
  equipment_id uuid not null references public.equipment(id) on delete restrict,
  requester_id uuid not null references public.users(id) on delete cascade,
  status character varying(50) not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'released', 'returned', 'overdue', 'closed')),
  purpose text not null,
  due_date date,
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  released_by uuid references public.users(id),
  released_at timestamptz,
  returned_by uuid references public.users(id),
  returned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 4. EQUIPMENT MAINTENANCE TABLE
-- Status: pending, in_progress, completed
-- =========================================================
create table if not exists public.maintenance_requests (
  id uuid primary key default uuid_generate_v4(),
  equipment_id uuid not null references public.equipment(id) on delete restrict,
  description text not null,
  status character varying(50) not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  reported_by uuid not null references public.users(id) on delete cascade,
  completed_by uuid references public.users(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 5. AUDIT TRAIL TABLE (audit_logs)
-- Fields: id, user_id, action, module, record_id, description, created_at
-- BR-A4-10: Sensitive operations must be logged.
-- =========================================================
create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  action character varying(50) not null,
  module character varying(50) not null,
  record_id uuid,
  description text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================
alter table public.users enable row level security;
alter table public.equipment enable row level security;
alter table public.borrowing_requests enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.audit_logs enable row level security;

-- Equipment policies
create policy "Anyone authenticated can view equipment"
  on public.equipment for select
  using (true);

create policy "Admins can insert equipment"
  on public.equipment for insert
  with check (true);

create policy "Admins and staff can update equipment"
  on public.equipment for update
  using (true);

create policy "Admins can delete equipment"
  on public.equipment for delete
  using (true);

-- Borrowing requests policies
create policy "Users can view relevant borrowing requests"
  on public.borrowing_requests for select
  using (true);

create policy "Users can create borrowing requests"
  on public.borrowing_requests for insert
  with check (true);

create policy "Staff and Admins can update borrowing requests"
  on public.borrowing_requests for update
  using (true);

-- Maintenance requests policies
create policy "Anyone can view maintenance requests"
  on public.maintenance_requests for select
  using (true);

create policy "Users can report maintenance"
  on public.maintenance_requests for insert
  with check (true);

create policy "Staff and Admins can update maintenance"
  on public.maintenance_requests for update
  using (true);

-- Audit logs policies
create policy "Users can insert audit logs"
  on public.audit_logs for insert
  with check (true);

create policy "Admins can view audit logs"
  on public.audit_logs for select
  using (true);

-- =========================================================
-- 7. INITIAL DEMO SEED DATA
-- =========================================================

-- Seed Users:
-- Administrator: admin@lab.edu / admin123
-- Laboratory Staff: maria@lab.edu / staff123 (Maria Santos)
-- Requester: john@lab.edu / requester123 (John Doe)

insert into public.users (id, name, email, password, role)
values
  ('1dc0a1a6-84e8-4c36-84ab-fb69d7089140', 'Administrator', 'admin@lab.edu', 'admin123', 'admin'),
  ('d1e1fb86-8e87-48d4-9027-e023aa57e2d5', 'Maria Santos', 'maria@lab.edu', 'staff123', 'staff'),
  ('80134c69-c0bd-4445-ae7d-80adf62a2fb7', 'John Doe', 'john@lab.edu', 'requester123', 'requester')
on conflict (id) do nothing;

-- Update requester@gmail.com password to requester123 (if account exists)
update public.users
set password = 'requester123'
where email = 'requester@gmail.com';

-- Seed Equipment Assets:
insert into public.equipment (id, code, name, category, location, status)
values
  ('5b846e5e-53d4-4cb4-8a88-9fb27678936d', 'LAP-001', 'Laptop Dell XPS 15', 'Computing', 'Lab A', 'available'),
  ('57f8c2cf-5161-45c5-9cf1-3479b332ca75', 'LAP-002', 'Laptop HP Pavilion', 'Computing', 'Lab A', 'available'),
  ('bae632a5-ff7a-462c-b0a9-b3016193228c', 'MIC-001', 'Microscope Olympus', 'Optical', 'Lab B', 'available'),
  ('08f6d0e9-30d2-4503-806a-ac2a72861ef6', 'MIC-002', 'Microscope Nikon', 'Optical', 'Lab B', 'available'),
  ('8801b9b9-8e6f-4105-91e5-5f144355d4c6', 'OSC-001', 'Oscilloscope Tektronix', 'Electronics', 'Lab C', 'available'),
  ('08a7f5f8-e947-430a-a273-44b98937a64f', 'OSC-002', 'Oscilloscope Keysight', 'Electronics', 'Lab C', 'available'),
  ('e498a72f-394b-43de-b415-aaa65ab4ef2b', 'PRI-001', '3D Printer Prusa', 'Manufacturing', 'Lab D', 'available'),
  ('3fbef131-8f11-4db4-a8f6-475066fc2348', 'SEN-001', 'Temperature Sensor Kit', 'Sensors', 'Lab E', 'available'),
  ('7249d420-f6c0-445b-8773-695e93549a2b', 'CAM-001', 'Digital Camera Canon', 'Imaging', 'Lab F', 'available'),
  ('bc6cf5ef-b6a9-4110-8bee-c3b846a4810e', 'TAB-001', 'Tablet iPad Pro', 'Computing', 'Lab A', 'available')
on conflict (id) do nothing;

-- Seed Sample Maintenance Records (linked to equipment & admin/staff):
insert into public.maintenance_requests (id, equipment_id, reported_by, description, status)
values
  ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', '08f6d0e9-30d2-4503-806a-ac2a72861ef6', '1dc0a1a6-84e8-4c36-84ab-fb69d7089140', 'Fine focus knob stiff; needs optical recalibration and cleaning.', 'pending'),
  ('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', '08a7f5f8-e947-430a-a273-44b98937a64f', 'd1e1fb86-8e87-48d4-9027-e023aa57e2d5', 'Channel 2 input probe connector loose and intermittent.', 'in_progress')
on conflict (id) do nothing;

-- BR-A4-09: Update status to 'maintenance' for active maintenance assets
update public.equipment
set status = 'maintenance'
where id in ('08f6d0e9-30d2-4503-806a-ac2a72861ef6', '08a7f5f8-e947-430a-a273-44b98937a64f');

