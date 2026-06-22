create type public.place_candidate_status as enum (
  'discovered',
  'in_review',
  'approved',
  'rejected',
  'duplicate'
);

create type public.place_candidate_review_action as enum (
  'hold',
  'approve',
  'reject',
  'mark_duplicate'
);

create table public.place_candidates (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('kakao')),
  external_id text not null,
  name text not null check (char_length(name) between 1 and 160),
  category text not null,
  address text not null check (char_length(address) between 2 and 300),
  road_address text,
  phone text,
  latitude numeric(9, 6) not null check (latitude between 33 and 39),
  longitude numeric(9, 6) not null check (longitude between 124 and 132),
  region_level_1 text not null,
  region_level_2 text not null,
  region_level_3 text,
  place_url text not null check (place_url ~ '^https?://'),
  status public.place_candidate_status not null default 'discovered',
  matched_location_id uuid references public.bakery_locations(id) on delete restrict,
  approved_location_id uuid references public.bakery_locations(id) on delete restrict,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id),
  constraint place_candidate_resolution check (
    (status = 'duplicate' and matched_location_id is not null and approved_location_id is null)
    or (status = 'approved' and approved_location_id is not null and matched_location_id is null)
    or (
      status in ('discovered', 'in_review', 'rejected')
      and matched_location_id is null
      and approved_location_id is null
    )
  )
);

create table public.place_candidate_review_actions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.place_candidates(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete restrict,
  reviewer_label text not null default 'authenticated_reviewer',
  action public.place_candidate_review_action not null,
  reason text not null check (char_length(reason) between 5 and 1000),
  previous_status public.place_candidate_status not null,
  next_status public.place_candidate_status not null,
  matched_location_id uuid references public.bakery_locations(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint place_candidate_review_actor_required check (
    reviewer_id is not null or reviewer_label = 'server_service'
  )
);

create index place_candidates_status_created_idx
  on public.place_candidates (status, created_at);
create index place_candidate_review_actions_candidate_idx
  on public.place_candidate_review_actions (candidate_id, created_at);

create trigger place_candidates_set_updated_at
before update on public.place_candidates
for each row execute function private.set_updated_at();

create or replace function public.review_place_candidate(
  candidate_id uuid,
  review_action public.place_candidate_review_action,
  review_reason text,
  duplicate_location_id uuid default null
)
returns public.place_candidates
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_candidate public.place_candidates;
  previous_status public.place_candidate_status;
  next_status public.place_candidate_status;
  new_brand_id uuid;
  new_location_id uuid;
  new_source_id uuid;
  brand_slug text;
  location_slug text;
begin
  if not private.is_reviewer() then
    raise exception 'reviewer role required';
  end if;

  if char_length(trim(review_reason)) < 5 then
    raise exception 'review reason must contain at least 5 characters';
  end if;

  select *
  into current_candidate
  from public.place_candidates
  where id = candidate_id
  for update;

  if current_candidate.id is null then
    raise exception 'place candidate not found';
  end if;

  if current_candidate.status in ('approved', 'rejected', 'duplicate') then
    raise exception 'place candidate is already resolved';
  end if;

  previous_status := current_candidate.status;

  case review_action
    when 'hold' then
      next_status := 'in_review';
    when 'reject' then
      next_status := 'rejected';
    when 'mark_duplicate' then
      if duplicate_location_id is null then
        raise exception 'duplicate location is required';
      end if;
      if not exists (
        select 1 from public.bakery_locations where id = duplicate_location_id
      ) then
        raise exception 'duplicate location not found';
      end if;
      next_status := 'duplicate';
    when 'approve' then
      next_status := 'approved';
    else
      raise exception 'unsupported candidate review action';
  end case;

  if review_action = 'approve' then
    brand_slug := 'kakao-brand-' || current_candidate.external_id;
    location_slug := 'kakao-' || current_candidate.external_id;

    insert into public.bakery_brands (name, slug, status)
    values (current_candidate.name, brand_slug, 'active')
    returning id into new_brand_id;

    insert into public.bakery_locations (
      brand_id,
      name,
      slug,
      status,
      road_address,
      lot_address,
      latitude,
      longitude,
      region_level_1,
      region_level_2,
      region_level_3,
      phone,
      published_at
    )
    values (
      new_brand_id,
      current_candidate.name,
      location_slug,
      'verification_needed',
      coalesce(nullif(current_candidate.road_address, ''), current_candidate.address),
      current_candidate.address,
      current_candidate.latitude,
      current_candidate.longitude,
      current_candidate.region_level_1,
      current_candidate.region_level_2,
      current_candidate.region_level_3,
      nullif(current_candidate.phone, ''),
      now()
    )
    returning id into new_location_id;

    insert into public.sources (
      type,
      url,
      publisher,
      retrieved_at,
      status
    )
    values (
      'map_api',
      current_candidate.place_url,
      '카카오 장소',
      current_candidate.last_seen_at,
      'accessible'
    )
    returning id into new_source_id;

    insert into public.verification_records (
      location_id,
      field,
      normalized_value,
      source_id,
      source_authority,
      result,
      grade,
      verified_by,
      verified_at,
      next_review_at,
      note
    )
    values
      (
        new_location_id,
        'address',
        jsonb_build_object(
          'roadAddress', current_candidate.road_address,
          'lotAddress', current_candidate.address
        ),
        new_source_id,
        'secondary',
        'supports',
        'C',
        (select auth.uid()),
        now(),
        now() + interval '30 days',
        '카카오 장소와 관리자 검수로 등록. 공식 또는 공공 출처 추가 확인 필요.'
      ),
      (
        new_location_id,
        'coordinates',
        jsonb_build_object(
          'latitude', current_candidate.latitude,
          'longitude', current_candidate.longitude
        ),
        new_source_id,
        'secondary',
        'supports',
        'C',
        (select auth.uid()),
        now(),
        now() + interval '180 days',
        '카카오 장소 좌표. 독립 출처 교차 확인 필요.'
      );

    if nullif(current_candidate.phone, '') is not null then
      insert into public.verification_records (
        location_id,
        field,
        normalized_value,
        source_id,
        source_authority,
        result,
        grade,
        verified_by,
        verified_at,
        next_review_at,
        note
      )
      values (
        new_location_id,
        'phone',
        jsonb_build_object('phone', current_candidate.phone),
        new_source_id,
        'secondary',
        'supports',
        'C',
        (select auth.uid()),
        now(),
        now() + interval '90 days',
        '카카오 장소 전화번호. 공식 채널 확인 필요.'
      );
    end if;
  end if;

  update public.place_candidates
  set
    status = next_status,
    matched_location_id = case
      when review_action = 'mark_duplicate' then duplicate_location_id
      else null
    end,
    approved_location_id = case
      when review_action = 'approve' then new_location_id
      else null
    end,
    reviewed_at = case
      when next_status in ('approved', 'rejected', 'duplicate') then now()
      else null
    end
  where id = candidate_id
  returning * into current_candidate;

  insert into public.place_candidate_review_actions (
    candidate_id,
    reviewer_id,
    reviewer_label,
    action,
    reason,
    previous_status,
    next_status,
    matched_location_id
  )
  values (
    candidate_id,
    (select auth.uid()),
    case
      when (select auth.role()) = 'service_role' then 'server_service'
      else 'authenticated_reviewer'
    end,
    review_action,
    trim(review_reason),
    previous_status,
    next_status,
    duplicate_location_id
  );

  return current_candidate;
end;
$$;

revoke all on function public.review_place_candidate(
  uuid,
  public.place_candidate_review_action,
  text,
  uuid
) from public;
grant execute on function public.review_place_candidate(
  uuid,
  public.place_candidate_review_action,
  text,
  uuid
) to authenticated, service_role;

alter table public.place_candidates enable row level security;
alter table public.place_candidate_review_actions enable row level security;

create policy "reviewers read place candidates"
on public.place_candidates for select
to authenticated
using (private.is_reviewer());

create policy "reviewers read place candidate actions"
on public.place_candidate_review_actions for select
to authenticated
using (private.is_reviewer());

grant select on public.place_candidates to authenticated;
grant select on public.place_candidate_review_actions to authenticated;
grant all on public.place_candidates to service_role;
grant all on public.place_candidate_review_actions to service_role;
