create table public.place_candidate_evidence (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.place_candidates(id) on delete cascade,
  provider text not null check (provider in ('sbiz')),
  external_id text not null,
  name text not null,
  industry_large text,
  industry_middle text,
  industry_small text,
  lot_address text,
  road_address text,
  latitude numeric(9, 6) not null check (latitude between 33 and 39),
  longitude numeric(9, 6) not null check (longitude between 124 and 132),
  match_score integer not null check (match_score between 0 and 100),
  match_reasons text[] not null default '{}',
  retrieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, provider, external_id)
);

create index place_candidate_evidence_candidate_score_idx
  on public.place_candidate_evidence (candidate_id, match_score desc);

create trigger place_candidate_evidence_set_updated_at
before update on public.place_candidate_evidence
for each row execute function private.set_updated_at();

create or replace function private.apply_candidate_cross_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  evidence public.place_candidate_evidence;
  source_id uuid;
begin
  if new.status <> 'approved'
    or new.approved_location_id is null
    or old.status = 'approved'
  then
    return new;
  end if;

  select *
  into evidence
  from public.place_candidate_evidence
  where candidate_id = new.id
    and match_score >= 70
  order by match_score desc, retrieved_at desc
  limit 1;

  if evidence.id is null then
    return new;
  end if;

  insert into public.sources (
    type,
    url,
    publisher,
    retrieved_at,
    status
  )
  values (
    'public_data',
    'https://www.data.go.kr/data/15012005/openapi.do',
    '소상공인시장진흥공단 상가(상권)정보',
    evidence.retrieved_at,
    'accessible'
  )
  returning id into source_id;

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
      new.approved_location_id,
      'address',
      jsonb_build_object(
        'roadAddress', evidence.road_address,
        'lotAddress', evidence.lot_address
      ),
      source_id,
      'authoritative',
      'supports',
      'B',
      (select auth.uid()),
      now(),
      now() + interval '90 days',
      '카카오 장소와 공공 상가정보의 주소 교차 확인'
    ),
    (
      new.approved_location_id,
      'coordinates',
      jsonb_build_object(
        'latitude', evidence.latitude,
        'longitude', evidence.longitude
      ),
      source_id,
      'authoritative',
      'supports',
      'B',
      (select auth.uid()),
      now(),
      now() + interval '90 days',
      '카카오 장소와 공공 상가정보의 좌표 교차 확인'
    );

  update public.verification_records
  set
    grade = 'B',
    next_review_at = now() + interval '90 days',
    note = concat_ws(
      ' ',
      note,
      '공공 상가정보와 교차 확인되어 B등급으로 승격.'
    )
  where location_id = new.approved_location_id
    and field in ('address', 'coordinates')
    and source_authority = 'secondary'
    and result = 'supports';

  return new;
end;
$$;

create trigger place_candidates_apply_cross_check
after update of status, approved_location_id on public.place_candidates
for each row execute function private.apply_candidate_cross_check();

alter table public.place_candidate_evidence enable row level security;

create policy "reviewers read place candidate evidence"
on public.place_candidate_evidence for select
to authenticated
using (private.is_reviewer());

grant select on public.place_candidate_evidence to authenticated;
grant all on public.place_candidate_evidence to service_role;
