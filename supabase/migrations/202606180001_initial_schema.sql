create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.brand_status as enum ('active', 'inactive');
create type public.location_status as enum (
  'draft',
  'active',
  'temporary_closed',
  'closed',
  'relocated',
  'verification_needed'
);
create type public.facility_state as enum ('yes', 'no', 'limited', 'unknown');
create type public.schedule_type as enum (
  'temporary_closed',
  'special_open',
  'changed_hours',
  'event'
);
create type public.schedule_status as enum (
  'draft',
  'confirmed',
  'expired',
  'cancelled'
);
create type public.menu_availability as enum (
  'regular',
  'seasonal',
  'limited',
  'unknown',
  'discontinued'
);
create type public.menu_status as enum ('active', 'hidden', 'discontinued');
create type public.account_platform as enum (
  'website',
  'instagram',
  'naver_blog',
  'naver_place',
  'kakao_channel',
  'youtube',
  'other'
);
create type public.account_officiality as enum (
  'official',
  'semi_official',
  'user_generated',
  'unknown'
);
create type public.resource_status as enum (
  'active',
  'accessible',
  'unavailable',
  'private',
  'deleted'
);
create type public.source_type as enum (
  'official_site',
  'official_sns',
  'phone',
  'map_api',
  'public_data',
  'tourism_data',
  'media',
  'user_report',
  'onsite',
  'other'
);
create type public.verification_field as enum (
  'address',
  'coordinates',
  'phone',
  'business_hours',
  'closure',
  'menu',
  'price',
  'facility',
  'official_account',
  'fame'
);
create type public.source_authority as enum (
  'official',
  'authoritative',
  'secondary',
  'community'
);
create type public.verification_result as enum (
  'confirmed',
  'supports',
  'conflicts',
  'superseded',
  'rejected'
);
create type public.verification_grade as enum ('A', 'B', 'C', 'D');
create type public.fame_type as enum (
  'award',
  'media',
  'heritage',
  'local_landmark',
  'specialty',
  'editorial',
  'save_count'
);
create type public.evidence_status as enum ('active', 'expired', 'disputed');
create type public.correction_category as enum (
  'hours',
  'closure',
  'relocation',
  'menu_price',
  'phone_address',
  'other'
);
create type public.correction_status as enum (
  'submitted',
  'triaged',
  'in_review',
  'accepted',
  'rejected',
  'duplicate'
);
create type public.review_action_type as enum (
  'triage',
  'approve',
  'reject',
  'hold',
  'mark_duplicate',
  'request_more_info'
);
create type public.app_role as enum ('user', 'reviewer', 'admin');

create table public.bakery_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  founded_year integer check (
    founded_year is null
    or founded_year between 1800 and 2100
  ),
  official_website_url text check (
    official_website_url is null
    or official_website_url ~ '^https?://'
  ),
  status public.brand_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bakery_locations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.bakery_brands(id) on delete restrict,
  seed_key text unique,
  name text not null check (char_length(name) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status public.location_status not null default 'draft',
  road_address text not null check (char_length(road_address) between 5 and 300),
  lot_address text,
  latitude numeric(9, 6) not null check (latitude between 33 and 39),
  longitude numeric(9, 6) not null check (longitude between 124 and 132),
  region_level_1 text not null,
  region_level_2 text not null,
  region_level_3 text,
  phone text,
  timezone text not null default 'Asia/Seoul',
  parking public.facility_state not null default 'unknown',
  seating public.facility_state not null default 'unknown',
  takeout public.facility_state not null default 'unknown',
  shipping public.facility_state not null default 'unknown',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint active_location_must_be_published check (
    status <> 'active' or published_at is not null
  )
);

create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.bakery_locations(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  sequence smallint not null default 1 check (sequence > 0),
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  valid_from date,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, day_of_week, sequence, valid_from),
  constraint business_hour_values_match_status check (
    (is_closed and opens_at is null and closes_at is null)
    or (not is_closed and opens_at is not null and closes_at is not null)
  ),
  constraint business_hour_valid_range check (
    valid_until is null or valid_from is null or valid_until >= valid_from
  )
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  type public.source_type not null,
  url text check (url is null or url ~ '^https?://'),
  publisher text,
  published_at timestamptz,
  effective_from timestamptz,
  effective_until timestamptz,
  retrieved_at timestamptz not null default now(),
  snapshot_ref text,
  status public.resource_status not null default 'accessible',
  created_at timestamptz not null default now(),
  constraint source_effective_range check (
    effective_until is null
    or effective_from is null
    or effective_until >= effective_from
  )
);

create table public.special_schedules (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.bakery_locations(id) on delete cascade,
  type public.schedule_type not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  opens_at time,
  closes_at time,
  note text check (note is null or char_length(note) <= 500),
  source_id uuid not null references public.sources(id) on delete restrict,
  status public.schedule_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint special_schedule_range check (ends_at > starts_at),
  constraint special_schedule_hours check (
    type in ('temporary_closed', 'event')
    or (opens_at is not null and closes_at is not null)
  )
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.bakery_locations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  description text,
  price integer check (price is null or price >= 0),
  price_note text,
  is_signature boolean not null default false,
  availability public.menu_availability not null default 'unknown',
  image_url text check (image_url is null or image_url ~ '^https?://'),
  checked_at timestamptz,
  status public.menu_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_price_requires_check_date check (
    price is null or checked_at is not null
  )
);

create table public.bread_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.bread_categories(id) on delete restrict,
  name text not null unique,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

create table public.location_bread_categories (
  location_id uuid not null references public.bakery_locations(id) on delete cascade,
  category_id uuid not null references public.bread_categories(id) on delete cascade,
  primary key (location_id, category_id)
);

create table public.external_accounts (
  id uuid primary key default gen_random_uuid(),
  location_id uuid references public.bakery_locations(id) on delete cascade,
  brand_id uuid references public.bakery_brands(id) on delete cascade,
  platform public.account_platform not null,
  url text not null check (url ~ '^https?://'),
  handle text,
  officiality public.account_officiality not null default 'unknown',
  officiality_evidence text,
  verified_at timestamptz,
  status public.resource_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_account_owner check (
    location_id is not null or brand_id is not null
  ),
  constraint official_account_requires_evidence check (
    officiality <> 'official'
    or (officiality_evidence is not null and verified_at is not null)
  )
);

alter table public.sources
  add column external_account_id uuid
  references public.external_accounts(id) on delete set null;

create table public.verification_records (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.bakery_locations(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete cascade,
  field public.verification_field not null,
  normalized_value jsonb not null,
  source_id uuid not null references public.sources(id) on delete restrict,
  source_authority public.source_authority not null,
  result public.verification_result not null,
  grade public.verification_grade not null,
  rule_version integer not null default 1 check (rule_version > 0),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz not null default now(),
  next_review_at timestamptz not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.fame_evidence (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.bakery_locations(id) on delete cascade,
  type public.fame_type not null,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  source_id uuid references public.sources(id) on delete restrict,
  occurred_at date,
  is_sponsored boolean not null default false,
  status public.evidence_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_bakeries (
  user_id uuid not null references auth.users(id) on delete cascade,
  location_id uuid not null references public.bakery_locations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, location_id)
);

create table public.correction_reports (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.bakery_locations(id) on delete restrict,
  reporter_id uuid references auth.users(id) on delete set null,
  category public.correction_category not null,
  proposed_value jsonb,
  description text not null check (char_length(description) between 10 and 1000),
  source_url text check (source_url is null or source_url ~ '^https?://'),
  status public.correction_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint correction_resolution_matches_status check (
    (
      status in ('accepted', 'rejected', 'duplicate')
      and resolved_at is not null
    )
    or (
      status not in ('accepted', 'rejected', 'duplicate')
      and resolved_at is null
    )
  )
);

create table public.review_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.correction_reports(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  action public.review_action_type not null,
  reason text not null check (char_length(reason) between 5 and 1000),
  previous_status public.correction_status not null,
  next_status public.correction_status not null,
  created_at timestamptz not null default now()
);

create index bakery_locations_brand_id_idx
  on public.bakery_locations (brand_id);
create index bakery_locations_region_idx
  on public.bakery_locations (region_level_1, region_level_2);
create index business_hours_location_day_idx
  on public.business_hours (location_id, day_of_week);
create index special_schedules_location_time_idx
  on public.special_schedules (location_id, starts_at, ends_at);
create index menu_items_location_status_idx
  on public.menu_items (location_id, status);
create index verification_records_location_field_idx
  on public.verification_records (location_id, field, verified_at desc);
create index saved_bakeries_user_id_idx
  on public.saved_bakeries (user_id);
create index correction_reports_reporter_id_idx
  on public.correction_reports (reporter_id);
create index correction_reports_status_created_idx
  on public.correction_reports (status, created_at);
create index review_actions_report_id_idx
  on public.review_actions (report_id, created_at);
create index user_roles_role_idx
  on public.user_roles (role);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger bakery_brands_set_updated_at
before update on public.bakery_brands
for each row execute function private.set_updated_at();
create trigger bakery_locations_set_updated_at
before update on public.bakery_locations
for each row execute function private.set_updated_at();
create trigger business_hours_set_updated_at
before update on public.business_hours
for each row execute function private.set_updated_at();
create trigger special_schedules_set_updated_at
before update on public.special_schedules
for each row execute function private.set_updated_at();
create trigger menu_items_set_updated_at
before update on public.menu_items
for each row execute function private.set_updated_at();
create trigger external_accounts_set_updated_at
before update on public.external_accounts
for each row execute function private.set_updated_at();
create trigger fame_evidence_set_updated_at
before update on public.fame_evidence
for each row execute function private.set_updated_at();
create trigger user_roles_set_updated_at
before update on public.user_roles
for each row execute function private.set_updated_at();
create trigger correction_reports_set_updated_at
before update on public.correction_reports
for each row execute function private.set_updated_at();

create or replace function private.is_reviewer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role in ('reviewer', 'admin')
  );
$$;

revoke all on function private.is_reviewer() from public;
grant execute on function private.is_reviewer() to authenticated;

create or replace function public.review_correction_report(
  report_id uuid,
  review_action public.review_action_type,
  review_reason text
)
returns public.correction_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_report public.correction_reports;
  previous_status public.correction_status;
  target_status public.correction_status;
begin
  if not private.is_reviewer() then
    raise exception 'reviewer role required' using errcode = '42501';
  end if;

  if char_length(trim(review_reason)) < 5 then
    raise exception 'review reason must contain at least 5 characters'
      using errcode = '22023';
  end if;

  select *
  into current_report
  from public.correction_reports
  where id = report_id
  for update;

  if not found then
    raise exception 'correction report not found' using errcode = 'P0002';
  end if;

  if current_report.status in ('accepted', 'rejected', 'duplicate') then
    raise exception 'correction report is already resolved'
      using errcode = '55000';
  end if;

  previous_status := current_report.status;

  target_status := case review_action
    when 'triage' then 'triaged'::public.correction_status
    when 'hold' then 'in_review'::public.correction_status
    when 'request_more_info' then 'in_review'::public.correction_status
    when 'approve' then 'accepted'::public.correction_status
    when 'reject' then 'rejected'::public.correction_status
    when 'mark_duplicate' then 'duplicate'::public.correction_status
  end;

  update public.correction_reports
  set
    status = target_status,
    resolved_at = case
      when target_status in ('accepted', 'rejected', 'duplicate') then now()
      else null
    end
  where id = report_id
  returning * into current_report;

  insert into public.review_actions (
    report_id,
    reviewer_id,
    action,
    reason,
    previous_status,
    next_status
  )
  values (
    report_id,
    (select auth.uid()),
    review_action,
    trim(review_reason),
    previous_status,
    target_status
  );

  return current_report;
end;
$$;

revoke all on function public.review_correction_report(
  uuid,
  public.review_action_type,
  text
) from public, anon;
grant execute on function public.review_correction_report(
  uuid,
  public.review_action_type,
  text
) to authenticated;

alter table public.bakery_brands enable row level security;
alter table public.bakery_locations enable row level security;
alter table public.business_hours enable row level security;
alter table public.sources enable row level security;
alter table public.special_schedules enable row level security;
alter table public.menu_items enable row level security;
alter table public.bread_categories enable row level security;
alter table public.location_bread_categories enable row level security;
alter table public.external_accounts enable row level security;
alter table public.verification_records enable row level security;
alter table public.fame_evidence enable row level security;
alter table public.user_roles enable row level security;
alter table public.saved_bakeries enable row level security;
alter table public.correction_reports enable row level security;
alter table public.review_actions enable row level security;

create policy "active brands are public"
on public.bakery_brands for select
to anon, authenticated
using (status = 'active');

create policy "published locations are public"
on public.bakery_locations for select
to anon, authenticated
using (status <> 'draft' and published_at is not null);

create policy "hours of published locations are public"
on public.business_hours for select
to anon, authenticated
using (
  exists (
    select 1 from public.bakery_locations
    where id = business_hours.location_id
      and status <> 'draft'
      and published_at is not null
  )
);

create policy "accessible sources are public"
on public.sources for select
to anon, authenticated
using (status = 'accessible');

create policy "confirmed schedules of published locations are public"
on public.special_schedules for select
to anon, authenticated
using (
  status = 'confirmed'
  and exists (
    select 1 from public.bakery_locations
    where id = special_schedules.location_id
      and status <> 'draft'
      and published_at is not null
  )
);

create policy "active menus of published locations are public"
on public.menu_items for select
to anon, authenticated
using (
  status = 'active'
  and exists (
    select 1 from public.bakery_locations
    where id = menu_items.location_id
      and status <> 'draft'
      and published_at is not null
  )
);

create policy "bread categories are public"
on public.bread_categories for select
to anon, authenticated
using (true);

create policy "published location categories are public"
on public.location_bread_categories for select
to anon, authenticated
using (
  exists (
    select 1 from public.bakery_locations
    where id = location_bread_categories.location_id
      and status <> 'draft'
      and published_at is not null
  )
);

create policy "active external accounts are public"
on public.external_accounts for select
to anon, authenticated
using (status = 'active');

create policy "verification records of published locations are public"
on public.verification_records for select
to anon, authenticated
using (
  exists (
    select 1 from public.bakery_locations
    where id = verification_records.location_id
      and status <> 'draft'
      and published_at is not null
  )
);

create policy "active fame evidence is public"
on public.fame_evidence for select
to anon, authenticated
using (status = 'active');

create policy "users can see their role"
on public.user_roles for select
to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "users manage their saved bakeries"
on public.saved_bakeries for all
to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()))
with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "users create their own correction reports"
on public.correction_reports for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and reporter_id = (select auth.uid())
  and status = 'submitted'
);

create policy "users read their own correction reports"
on public.correction_reports for select
to authenticated
using (
  ((select auth.uid()) is not null and reporter_id = (select auth.uid()))
  or private.is_reviewer()
);

create policy "reviewers read review actions"
on public.review_actions for select
to authenticated
using (private.is_reviewer());

revoke all on all tables in schema public from anon, authenticated;

grant select on public.bakery_brands to anon, authenticated;
grant select on public.bakery_locations to anon, authenticated;
grant select on public.business_hours to anon, authenticated;
grant select (
  id,
  type,
  url,
  external_account_id,
  publisher,
  published_at,
  effective_from,
  effective_until,
  retrieved_at,
  status,
  created_at
) on public.sources to anon, authenticated;
grant select on public.special_schedules to anon, authenticated;
grant select on public.menu_items to anon, authenticated;
grant select on public.bread_categories to anon, authenticated;
grant select on public.location_bread_categories to anon, authenticated;
grant select on public.external_accounts to anon, authenticated;
grant select (
  id,
  location_id,
  menu_item_id,
  field,
  normalized_value,
  source_id,
  source_authority,
  result,
  grade,
  rule_version,
  verified_at,
  next_review_at,
  created_at
) on public.verification_records to anon, authenticated;
grant select on public.fame_evidence to anon, authenticated;
grant select on public.user_roles to authenticated;
grant select, insert, delete on public.saved_bakeries to authenticated;
grant select, insert on public.correction_reports to authenticated;
grant select on public.review_actions to authenticated;

grant all on all tables in schema public to service_role;
grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;
