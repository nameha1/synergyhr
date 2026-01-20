-- Create holidays table for company-wide non-working days
create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  name text,
  created_at timestamptz not null default now()
);

alter table public.holidays enable row level security;

create policy "Anyone can view holidays"
on public.holidays
for select
using (true);

create policy "Admins can insert holidays"
on public.holidays
for insert
with check (is_admin());

create policy "Admins can update holidays"
on public.holidays
for update
using (is_admin());

create policy "Admins can delete holidays"
on public.holidays
for delete
using (is_admin());
