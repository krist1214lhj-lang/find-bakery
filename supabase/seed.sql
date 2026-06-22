insert into public.bakery_brands (id, name, slug, description)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '멜로우 오븐',
    'mellow-oven',
    'UI와 검증 흐름 테스트용 시드 브랜드'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '오래뜰 제과',
    'old-town-bakery',
    'UI와 검증 흐름 테스트용 시드 브랜드'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    '웨이브 베이글',
    'wave-bagel',
    'UI와 검증 흐름 테스트용 시드 브랜드'
  )
on conflict (id) do nothing;

insert into public.bakery_locations (
  id,
  brand_id,
  seed_key,
  name,
  search_aliases,
  slug,
  status,
  road_address,
  latitude,
  longitude,
  region_level_1,
  region_level_2,
  phone,
  parking,
  seating,
  takeout,
  shipping,
  published_at
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'bakery-seoul-001',
    '멜로우 오븐 성수점',
    array['MELLOW OVEN', '멜로우오븐', '멜로우 오븐 성수', '멜로우오븐 성수점'],
    'mellow-oven-seongsu',
    'active',
    '서울 성동구 연무장길 00',
    37.544500,
    127.056000,
    '서울',
    '성동구',
    '02-000-1001',
    'no',
    'limited',
    'yes',
    'unknown',
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'bakery-daejeon-001',
    '오래뜰 제과',
    array['OLD TOWN BAKERY', '올드 타운 베이커리', '올드타운베이커리'],
    'old-town-bakery-daejeon',
    'active',
    '대전 중구 중앙로 00',
    36.328000,
    127.427000,
    '대전',
    '중구',
    '042-000-2002',
    'limited',
    'yes',
    'yes',
    'unknown',
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    'bakery-busan-001',
    '웨이브 베이글',
    array['WAVE BAGEL', '웨이브베이글', '웨이브 베이글 부산'],
    'wave-bagel-busan',
    'verification_needed',
    '부산 수영구 광안해변로 00',
    35.153200,
    129.118700,
    '부산',
    '수영구',
    '051-000-3003',
    'unknown',
    'yes',
    'yes',
    'unknown',
    now()
  )
on conflict (id) do nothing;

insert into public.bread_categories (id, name, slug)
values
  ('30000000-0000-4000-8000-000000000001', '소금빵', 'salt-bread'),
  ('30000000-0000-4000-8000-000000000002', '베이글', 'bagel'),
  ('30000000-0000-4000-8000-000000000003', '크루아상', 'croissant'),
  ('30000000-0000-4000-8000-000000000004', '식사빵', 'meal-bread'),
  ('30000000-0000-4000-8000-000000000005', '케이크', 'cake'),
  ('30000000-0000-4000-8000-000000000006', '구움과자', 'baked-sweets')
on conflict (id) do nothing;

insert into public.location_bread_categories (location_id, category_id)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001'
  ),
  (
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000003'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000004'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000002'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000004'
  )
on conflict do nothing;

insert into public.business_hours (
  location_id,
  day_of_week,
  sequence,
  opens_at,
  closes_at,
  valid_from
)
select
  schedule.location_id,
  day_of_week,
  1,
  schedule.opens_at::time,
  schedule.closes_at::time,
  date '2026-01-01'
from (
  values
    ('20000000-0000-4000-8000-000000000001'::uuid, '10:00', '19:00'),
    ('20000000-0000-4000-8000-000000000002'::uuid, '08:00', '21:00'),
    ('20000000-0000-4000-8000-000000000003'::uuid, '09:00', '18:00')
) as schedule(location_id, opens_at, closes_at)
cross join generate_series(1, 7) as day_of_week
on conflict (location_id, day_of_week, sequence, valid_from) do update
set
  opens_at = excluded.opens_at,
  closes_at = excluded.closes_at,
  is_closed = false;

insert into public.menu_items (
  id,
  location_id,
  name,
  price,
  is_signature,
  availability,
  checked_at
)
values
  (
    '50000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '버터 소금빵',
    3500,
    true,
    'regular',
    '2026-06-10T10:00:00+09:00'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    '아몬드 크루아상',
    4800,
    true,
    'regular',
    '2026-06-10T10:00:00+09:00'
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    '팥소보로',
    2800,
    true,
    'regular',
    '2026-05-20T10:00:00+09:00'
  ),
  (
    '50000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000002',
    '우유 식빵',
    5200,
    true,
    'regular',
    '2026-05-20T10:00:00+09:00'
  ),
  (
    '50000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000003',
    '플레인 베이글',
    3200,
    true,
    'regular',
    '2026-02-12T12:00:00+09:00'
  ),
  (
    '50000000-0000-4000-8000-000000000006',
    '20000000-0000-4000-8000-000000000003',
    '쪽파 크림치즈',
    2900,
    true,
    'regular',
    '2026-02-12T12:00:00+09:00'
  )
on conflict (id) do update
set
  name = excluded.name,
  price = excluded.price,
  is_signature = excluded.is_signature,
  availability = excluded.availability,
  checked_at = excluded.checked_at,
  status = 'active';

insert into public.sources (
  id,
  type,
  url,
  publisher,
  retrieved_at
)
values
  (
    '60000000-0000-4000-8000-000000000001',
    'official_sns',
    'https://www.instagram.com/',
    '공식 인스타그램',
    '2026-06-16T03:00:00+09:00'
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    'map_api',
    'https://map.kakao.com/',
    '지도·공공데이터 교차 확인',
    '2026-05-25T11:00:00+09:00'
  ),
  (
    '60000000-0000-4000-8000-000000000003',
    'official_sns',
    'https://www.instagram.com/',
    '공식 메뉴 게시물',
    '2026-02-12T12:00:00+09:00'
  )
on conflict (id) do update
set
  type = excluded.type,
  url = excluded.url,
  publisher = excluded.publisher,
  retrieved_at = excluded.retrieved_at,
  status = 'accessible';

insert into public.verification_records (
  id,
  location_id,
  field,
  normalized_value,
  source_id,
  source_authority,
  result,
  grade,
  verified_at,
  next_review_at,
  note
)
values
  (
    '70000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'business_hours',
    '{"opensAt":"10:00","closesAt":"19:00"}',
    '60000000-0000-4000-8000-000000000001',
    'official',
    'confirmed',
    'A',
    '2026-06-16T03:00:00+09:00',
    '2026-07-16T03:00:00+09:00',
    '공식 채널에서 영업시간 확인'
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'business_hours',
    '{"opensAt":"08:00","closesAt":"21:00"}',
    '60000000-0000-4000-8000-000000000002',
    'authoritative',
    'confirmed',
    'B',
    '2026-05-25T11:00:00+09:00',
    '2026-08-23T11:00:00+09:00',
    '지도와 공공데이터 교차 확인'
  ),
  (
    '70000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000003',
    'business_hours',
    '{"opensAt":"09:00","closesAt":"18:00"}',
    '60000000-0000-4000-8000-000000000003',
    'official',
    'supports',
    'C',
    '2026-02-12T12:00:00+09:00',
    '2026-05-13T12:00:00+09:00',
    '확인일이 지나 재검토 필요'
  )
on conflict (id) do update
set
  normalized_value = excluded.normalized_value,
  source_id = excluded.source_id,
  source_authority = excluded.source_authority,
  result = excluded.result,
  grade = excluded.grade,
  verified_at = excluded.verified_at,
  next_review_at = excluded.next_review_at,
  note = excluded.note;

insert into public.fame_evidence (
  id,
  location_id,
  type,
  title,
  description,
  source_id,
  status
)
values
  (
    '80000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'specialty',
    '소금빵과 크루아상 전문',
    '결이 선명한 크루아상과 매일 굽는 소금빵을 중심으로 소개하는 베이커리예요.',
    '60000000-0000-4000-8000-000000000001',
    'active'
  ),
  (
    '80000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'heritage',
    '지역 장기 운영 제과점',
    '지역에서 오래 운영한 제과점으로 알려진 이유를 출처와 함께 관리해요.',
    '60000000-0000-4000-8000-000000000002',
    'active'
  ),
  (
    '80000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000003',
    'specialty',
    '해변 인근 베이글 전문점',
    '해변 산책 동선에서 베이글과 크림치즈 메뉴를 함께 찾기 좋은 곳이에요.',
    '60000000-0000-4000-8000-000000000003',
    'active'
  )
on conflict (id) do update
set
  title = excluded.title,
  description = excluded.description,
  source_id = excluded.source_id,
  status = excluded.status;
