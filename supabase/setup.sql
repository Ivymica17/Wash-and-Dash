create table if not exists public.admin_users (
  email text primary key,
  user_id uuid unique references auth.users (id) on delete cascade
);

create table if not exists public.bookings (
  id text primary key,
  customer text not null,
  phone text not null,
  email text not null,
  pickup_address text not null,
  delivery_address text not null,
  instructions text not null default '',
  service text not null,
  service_key text not null,
  weight numeric not null,
  add_ons jsonb not null default '{}'::jsonb,
  booking_date date not null,
  time_slot text not null check (time_slot in ('morning', 'afternoon')),
  pickup_time text not null,
  payment text not null,
  service_fee numeric not null,
  add_on_fees numeric not null,
  delivery_fee numeric not null,
  total numeric not null,
  status text not null default 'Booking Confirmed',
  status_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bookings_schedule_idx
  on public.bookings (booking_date, time_slot)
  where status <> 'Cancelled';

alter table public.admin_users enable row level security;
alter table public.bookings enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create policy "Admins can read their own admin record"
  on public.admin_users for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.link_allowlisted_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.admin_users
  set user_id = new.id
  where lower(email) = lower(new.email) and user_id is null;
  return new;
end;
$$;

drop trigger if exists link_allowlisted_admin on auth.users;
create trigger link_allowlisted_admin
  after insert on auth.users
  for each row execute procedure public.link_allowlisted_admin();

create policy "Public can submit bookings"
  on public.bookings for insert to anon, authenticated
  with check (
    status = 'Booking Confirmed'
    and id ~ '^WD-[0-9]{4}-[0-9A-HJKMNP-TV-Z]{10}$'
  );

create policy "Admins can read bookings"
  on public.bookings for select to authenticated
  using ((select public.is_admin()));

create policy "Admins can update bookings"
  on public.bookings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create or replace function public.enforce_booking_slot_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.booking_date::text || ':' || new.time_slot, 0));
  select count(*) into existing_count
  from public.bookings
  where booking_date = new.booking_date
    and time_slot = new.time_slot
    and status <> 'Cancelled';
  if existing_count >= 5 then
    raise exception 'This pickup slot is full.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_booking_slot_capacity on public.bookings;
create trigger enforce_booking_slot_capacity
  before insert on public.bookings
  for each row execute procedure public.enforce_booking_slot_capacity();

grant usage on schema public to anon, authenticated;
grant insert on public.bookings to anon, authenticated;
grant select, update on public.bookings to authenticated;
grant select on public.admin_users to authenticated;

create or replace function public.get_slot_counts(p_start date, p_end date)
returns table (booking_date date, time_slot text, booking_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select b.booking_date, b.time_slot, count(*)
  from public.bookings b
  where b.booking_date between p_start and p_end
    and b.status <> 'Cancelled'
  group by b.booking_date, b.time_slot;
$$;

revoke all on function public.get_slot_counts(date, date) from public;
grant execute on function public.get_slot_counts(date, date) to anon, authenticated;

create or replace function public.get_booking_tracking(p_reference text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', id,
    'service', service,
    'weight', weight,
    'date', booking_date,
    'time', pickup_time,
    'total', total,
    'status', status,
    'statusHistory', status_history
  )
  from public.bookings
  where upper(id) = upper(p_reference)
  limit 1;
$$;

revoke all on function public.get_booking_tracking(text) from public;
grant execute on function public.get_booking_tracking(text) to anon, authenticated;

-- Add the first admin email here before that person signs up in the admin panel.
-- insert into public.admin_users (email) values ('owner@example.com');