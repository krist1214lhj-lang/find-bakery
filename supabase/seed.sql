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
  ('30000000-0000-4000-8000-000000000004', '식사빵', 'meal-bread')
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
  )
on conflict do nothing;

