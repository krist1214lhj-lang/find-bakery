-- 검증된 빵집 1곳 추가: 뺑드미 아차산점 (웹 교차검증 완료, 2026-06-24)
-- 안전: INSERT만 사용 / 단일 트랜잭션 / 이름·slug 중복 시 자동 건너뜀 / 재실행 가능(idempotent).
-- 구조 변경 없음, quest_ 접두사 테이블 미사용.
-- 좌표는 근사값(추후 정확값으로 교체 권장).
--
-- ── 실행 전 사전 확인 (선택, 읽기 전용) ───────────────────────────────
-- 아래 쿼리로 카테고리 2개가 있는지 먼저 확인하세요.
-- 2행(meal-bread, cake)이 안 나오면 supabase/seed.sql 의 카테고리부터 먼저 넣어야
-- 3번(카테고리 연결)이 동작합니다. 안 그러면 케이크 카테고리가 계속 비어 있습니다.
--
--   select slug from public.bread_categories where slug in ('meal-bread', 'cake');
--
-- ── 실행 후 반영 확인 (선택, 읽기 전용) ───────────────────────────────
--   select l.name, l.slug, l.status,
--          array_agg(c.slug order by c.slug) as categories
--   from public.bakery_locations l
--   left join public.location_bread_categories lbc on lbc.location_id = l.id
--   left join public.bread_categories c on c.id = lbc.category_id
--   where l.slug = 'paindemie-achasan'
--   group by l.id, l.name, l.slug, l.status;
--   -- 기대: categories = {cake, meal-bread}
-- ──────────────────────────────────────────────────────────────────────

begin;

-- 1) 브랜드 (slug 중복 시 건너뜀)
insert into public.bakery_brands (id, name, slug, description)
values ('a1000000-0000-4000-8000-000000000001', '뺑드미', 'paindemie',
        '아차산 인근 베이커리 (웹 교차검증으로 추가)')
on conflict (slug) do nothing;

-- 2) 빵집 위치: 같은 slug 또는 같은 이름이 이미 있으면 건너뜀
insert into public.bakery_locations (
  id, brand_id, seed_key, name, search_aliases, slug, status,
  road_address, latitude, longitude, region_level_1, region_level_2, published_at
)
select
  'a2000000-0000-4000-8000-000000000001',
  b.id,
  'bakery-seoul-paindemie-achasan',
  '뺑드미 아차산점',
  array['Pain de Mie','뺑드미','뺑드미 아차산','paindemie'],
  'paindemie-achasan',
  'active',
  '서울 광진구 영화사로 45',
  37.564000,                 -- 근사 좌표 (추후 정확값 교체 권장)
  127.102000,                -- 근사 좌표
  '서울', '광진구',
  now()
from public.bakery_brands b
where b.slug = 'paindemie'
  and not exists (
    select 1 from public.bakery_locations
    where slug = 'paindemie-achasan' or name = '뺑드미 아차산점'
  )
on conflict (slug) do nothing;

-- 3) 카테고리 연결: meal-bread, cake (location은 slug로 조회)
insert into public.location_bread_categories (location_id, category_id)
select l.id, c.id
from public.bakery_locations l
join public.bread_categories c on c.slug in ('meal-bread', 'cake')
where l.slug = 'paindemie-achasan'
on conflict do nothing;

-- 4) 영업시간: 화~일 11:30-22:00, 월요일 휴무
insert into public.business_hours
  (location_id, day_of_week, sequence, opens_at, closes_at, is_closed, valid_from)
select l.id, d, 1, time '11:30', time '22:00', false, date '2026-01-01'
from public.bakery_locations l
cross join generate_series(2, 7) as d
where l.slug = 'paindemie-achasan'
on conflict (location_id, day_of_week, sequence, valid_from) do nothing;

insert into public.business_hours
  (location_id, day_of_week, sequence, opens_at, closes_at, is_closed, valid_from)
select l.id, 1, 1, null, null, true, date '2026-01-01'
from public.bakery_locations l
where l.slug = 'paindemie-achasan'
on conflict (location_id, day_of_week, sequence, valid_from) do nothing;

-- 5) 출처 (교차확인)
insert into public.sources (id, type, url, publisher, retrieved_at, status)
values ('a6000000-0000-4000-8000-000000000001', 'media',
        'https://www.diningcode.com/',
        '다이닝코드·네이버 블로그·나무위키 교차확인',
        '2026-06-24T10:00:00+09:00', 'accessible')
on conflict (id) do nothing;

-- 6) 검증 기록: grade=B, 확인일 2026-06-24 (location은 slug로 조회)
insert into public.verification_records (
  id, location_id, field, normalized_value, source_id,
  source_authority, result, grade, verified_at, next_review_at, note
)
select
  'a7000000-0000-4000-8000-000000000001',
  l.id, 'business_hours',
  '{"opensAt":"11:30","closesAt":"22:00"}'::jsonb,
  'a6000000-0000-4000-8000-000000000001',
  'secondary', 'confirmed', 'B',
  '2026-06-24T10:00:00+09:00', '2026-09-22T10:00:00+09:00',
  '다이닝코드·네이버 블로그·나무위키 3개 출처 교차확인 (B등급)'
from public.bakery_locations l
where l.slug = 'paindemie-achasan'
on conflict (id) do nothing;

-- 7) 대표메뉴 (price 미상 → null, checked_at 채움)
insert into public.menu_items
  (id, location_id, name, price, is_signature, availability, checked_at)
select v.id::uuid, l.id, v.name, null, v.is_signature, 'regular',
       '2026-06-24T10:00:00+09:00'
from public.bakery_locations l
cross join (values
  ('a5000000-0000-4000-8000-000000000001', '치아바타',   true),
  ('a5000000-0000-4000-8000-000000000002', '당근케이크', true),
  ('a5000000-0000-4000-8000-000000000003', '소보루',     false),
  ('a5000000-0000-4000-8000-000000000004', '밤식빵',     false)
) as v(id, name, is_signature)
where l.slug = 'paindemie-achasan'
on conflict (id) do nothing;

-- 8) 인스타 계정 (officiality=semi_official)
insert into public.external_accounts
  (id, location_id, platform, url, handle, officiality, status)
select 'a3000000-0000-4000-8000-000000000001', l.id, 'instagram',
       'https://www.instagram.com/paindemie_bakery', 'paindemie_bakery',
       'semi_official', 'active'
from public.bakery_locations l
where l.slug = 'paindemie-achasan'
on conflict (id) do nothing;

commit;
