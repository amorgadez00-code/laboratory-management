-- Roles: requester, staff, admin
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  role text not null default 'requester' check (role in ('requester', 'staff', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipment (
  id bigserial primary key,
  asset_code text not null unique,
  equipment_name text not null,
  category text,
  description text,
  quantity integer not null check (quantity > 0),
  available_quantity integer not null default 0 check (available_quantity >= 0),
  status text not null default 'available' check (status in ('available', 'borrowed', 'maintenance')),
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.borrowing_requests (
  id bigserial primary key,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  equipment_id bigint not null references public.equipment(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  purpose text not null,
  due_date date,
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected','Released','Returned','Overdue','Closed')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  released_at timestamptz,
  returned_at timestamptz,
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maintenance_requests (
  id bigserial primary key,
  equipment_id bigint not null references public.equipment(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  issue_description text not null,
  status text not null default 'Pending' check (status in ('Pending','In Progress','Completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  module text not null,
  record_id bigint,
  description text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.equipment enable row level security;
alter table public.borrowing_requests enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.audit_logs enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  using (auth.uid() is not null);

create policy "Users can update their own profile except role"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id and
    (role is null or role = old.role)
  );

create policy "Admins manage profiles"
  on public.profiles for update
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

create policy "Anyone authenticated can read equipment"
  on public.equipment for select
  using (auth.uid() is not null);

create policy "Admins manage equipment"
  on public.equipment for insert
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

create policy "Admins update equipment"
  on public.equipment for update
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

create policy "Admins delete equipment"
  on public.equipment for delete
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

create policy "Users can view borrowing requests"
  on public.borrowing_requests for select
  using (
    auth.uid() is not null and (
      requester_id = auth.uid() or
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('staff','admin')
      )
    )
  );

create policy "Requesters can create requests"
  on public.borrowing_requests for insert
  with check (
    auth.uid() is not null and requester_id = auth.uid()
  );

create policy "Staff and admins can update request status"
  on public.borrowing_requests for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('staff','admin')
    )
  );

create policy "Users can read their maintenance requests"
  on public.maintenance_requests for select
  using (
    auth.uid() is not null and (
      requested_by = auth.uid() or
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('staff','admin')
      )
    )
  );

create policy "Requesters can create maintenance requests"
  on public.maintenance_requests for insert
  with check (
    auth.uid() is not null and requested_by = auth.uid()
  );

create policy "Staff and admins can update maintenance requests"
  on public.maintenance_requests for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('staff','admin')
    )
  );

create policy "Admins can view audit logs"
  on public.audit_logs for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Authenticated users can insert audit logs"
  on public.audit_logs for insert
  with check (auth.uid() = user_id);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger set_equipment_updated_at
before update on public.equipment
for each row execute procedure public.set_updated_at();

create trigger set_borrowing_requests_updated_at
before update on public.borrowing_requests
for each row execute procedure public.set_updated_at();

create trigger set_maintenance_requests_updated_at
before update on public.maintenance_requests
for each row execute procedure public.set_updated_at();

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'New User'),
    new.email,
    'requester'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
