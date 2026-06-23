create table public.official_verification_actions (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.bakery_locations(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  source_id uuid not null references public.sources(id) on delete restrict,
  verification_record_id uuid not null references public.verification_records(id) on delete restrict,
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_label text not null default 'authenticated_reviewer',
  field public.verification_field not null,
  source_type public.source_type not null,
  note text not null check (char_length(trim(note)) >= 5),
  created_at timestamptz not null default now(),
  constraint official_verification_actor_required check (
    reviewer_id is not null or reviewer_label = 'server_service'
  )
);

create index official_verification_actions_location_idx
  on public.official_verification_actions (location_id, created_at desc);

create or replace function public.register_official_verification(
  target_location_id uuid,
  target_field public.verification_field,
  verification_note text,
  official_source_type public.source_type,
  source_publisher text,
  source_url text default null,
  source_published_at timestamptz default null,
  source_effective_from timestamptz default null,
  source_effective_until timestamptz default null,
  target_menu_item_id uuid default null,
  account_platform public.account_platform default null,
  account_handle text default null,
  account_officiality_evidence text default null
)
returns public.verification_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_location public.bakery_locations;
  target_menu public.menu_items;
  account_id uuid;
  new_source_id uuid;
  normalized jsonb;
  next_review interval;
  new_verification public.verification_records;
begin
  if not private.is_reviewer() then
    raise exception 'reviewer role required' using errcode = '42501';
  end if;

  if official_source_type not in ('official_site', 'official_sns', 'phone', 'onsite') then
    raise exception 'official source type required' using errcode = '22023';
  end if;

  if target_field in ('coordinates', 'fame') then
    raise exception 'field is not supported by official verification flow'
      using errcode = '22023';
  end if;

  if char_length(trim(verification_note)) < 5 then
    raise exception 'verification note must contain at least 5 characters'
      using errcode = '22023';
  end if;

  if char_length(trim(source_publisher)) < 2 then
    raise exception 'source publisher must contain at least 2 characters'
      using errcode = '22023';
  end if;

  if source_effective_until is not null
    and source_effective_from is not null
    and source_effective_until < source_effective_from then
    raise exception 'source effective range is invalid' using errcode = '22023';
  end if;

  if official_source_type in ('official_site', 'official_sns') then
    if source_url is null or source_url !~ '^https?://' then
      raise exception 'official web sources require a valid URL'
        using errcode = '22023';
    end if;

    if account_platform is null then
      raise exception 'official web sources require an account platform'
        using errcode = '22023';
    end if;

    if official_source_type = 'official_site' and account_platform <> 'website' then
      raise exception 'official site must use website platform'
        using errcode = '22023';
    end if;

    if official_source_type = 'official_sns' and account_platform = 'website' then
      raise exception 'official SNS must use an SNS platform'
        using errcode = '22023';
    end if;

    if char_length(trim(coalesce(account_officiality_evidence, ''))) < 5 then
      raise exception 'official account evidence must contain at least 5 characters'
        using errcode = '22023';
    end if;
  elsif target_field = 'official_account' then
    raise exception 'official account verification requires an official web source'
      using errcode = '22023';
  elsif source_url is not null or account_platform is not null then
    raise exception 'phone and onsite sources cannot create an external account'
      using errcode = '22023';
  end if;

  select *
  into target_location
  from public.bakery_locations
  where id = target_location_id
  for update;

  if not found then
    raise exception 'bakery location not found' using errcode = 'P0002';
  end if;

  if target_field in ('menu', 'price') then
    if target_menu_item_id is null then
      raise exception 'menu verification requires a menu item'
        using errcode = '22023';
    end if;

    select *
    into target_menu
    from public.menu_items
    where id = target_menu_item_id
      and location_id = target_location_id;

    if not found then
      raise exception 'menu item not found for bakery location'
        using errcode = 'P0002';
    end if;
  elsif target_menu_item_id is not null then
    raise exception 'menu item is only valid for menu or price verification'
      using errcode = '22023';
  end if;

  if official_source_type in ('official_site', 'official_sns') then
    select id
    into account_id
    from public.external_accounts
    where location_id = target_location_id
      and platform = account_platform
      and url = source_url
      and status not in ('deleted', 'unavailable')
    order by verified_at desc nulls last
    limit 1
    for update;

    if account_id is null then
      insert into public.external_accounts (
        location_id,
        platform,
        url,
        handle,
        officiality,
        officiality_evidence,
        verified_at,
        status
      )
      values (
        target_location_id,
        account_platform,
        source_url,
        nullif(trim(coalesce(account_handle, '')), ''),
        'official',
        trim(account_officiality_evidence),
        now(),
        'active'
      )
      returning id into account_id;
    else
      update public.external_accounts
      set
        handle = coalesce(
          nullif(trim(coalesce(account_handle, '')), ''),
          handle
        ),
        officiality = 'official',
        officiality_evidence = trim(account_officiality_evidence),
        verified_at = now(),
        status = 'active'
      where id = account_id;
    end if;
  end if;

  insert into public.sources (
    type,
    url,
    external_account_id,
    publisher,
    published_at,
    effective_from,
    effective_until,
    retrieved_at,
    status
  )
  values (
    official_source_type,
    source_url,
    account_id,
    trim(source_publisher),
    source_published_at,
    source_effective_from,
    source_effective_until,
    now(),
    'accessible'
  )
  returning id into new_source_id;

  normalized := case target_field
    when 'address' then jsonb_build_object(
      'roadAddress', target_location.road_address,
      'lotAddress', target_location.lot_address
    )
    when 'phone' then
      case
        when target_location.phone is null then null
        else jsonb_build_object('phone', target_location.phone)
      end
    when 'business_hours' then (
      select jsonb_agg(
        jsonb_build_object(
          'dayOfWeek', day_of_week,
          'sequence', sequence,
          'opensAt', opens_at,
          'closesAt', closes_at,
          'isClosed', is_closed,
          'validFrom', valid_from,
          'validUntil', valid_until
        )
        order by day_of_week, sequence
      )
      from public.business_hours
      where location_id = target_location_id
    )
    when 'closure' then jsonb_build_object('status', target_location.status)
    when 'menu' then jsonb_build_object(
      'name', target_menu.name,
      'availability', target_menu.availability,
      'status', target_menu.status
    )
    when 'price' then
      case
        when target_menu.price is null then null
        else jsonb_build_object(
          'name', target_menu.name,
          'price', target_menu.price,
          'priceNote', target_menu.price_note
        )
      end
    when 'facility' then jsonb_build_object(
      'parking', target_location.parking,
      'seating', target_location.seating,
      'takeout', target_location.takeout,
      'shipping', target_location.shipping
    )
    when 'official_account' then
      case
        when account_id is null then null
        else jsonb_build_object(
          'externalAccountId', account_id,
          'platform', account_platform,
          'url', source_url,
          'handle', nullif(trim(coalesce(account_handle, '')), '')
        )
      end
    else null
  end;

  if normalized is null then
    raise exception 'target field has no current value to verify'
      using errcode = '22023';
  end if;

  next_review := case target_field
    when 'business_hours' then interval '30 days'
    when 'closure' then interval '30 days'
    when 'phone' then interval '90 days'
    when 'menu' then interval '90 days'
    when 'price' then interval '90 days'
    when 'facility' then interval '90 days'
    when 'address' then interval '180 days'
    when 'official_account' then interval '180 days'
    else interval '90 days'
  end;

  if target_field = 'price' then
    update public.menu_items
    set checked_at = now()
    where id = target_menu_item_id;
  end if;

  update public.verification_records
  set result = 'superseded'
  where location_id = target_location_id
    and field = target_field
    and menu_item_id is not distinct from target_menu_item_id
    and result in ('confirmed', 'supports', 'conflicts');

  insert into public.verification_records (
    location_id,
    menu_item_id,
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
    target_location_id,
    target_menu_item_id,
    target_field,
    normalized,
    new_source_id,
    'official',
    'confirmed',
    'A',
    (select auth.uid()),
    now(),
    now() + next_review,
    trim(verification_note)
  )
  returning * into new_verification;

  insert into public.official_verification_actions (
    location_id,
    menu_item_id,
    source_id,
    verification_record_id,
    reviewer_id,
    reviewer_label,
    field,
    source_type,
    note
  )
  values (
    target_location_id,
    target_menu_item_id,
    new_source_id,
    new_verification.id,
    (select auth.uid()),
    case
      when (select auth.role()) = 'service_role' then 'server_service'
      else 'authenticated_reviewer'
    end,
    target_field,
    official_source_type,
    trim(verification_note)
  );

  return new_verification;
end;
$$;

revoke all on function public.register_official_verification(
  uuid,
  public.verification_field,
  text,
  public.source_type,
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  uuid,
  public.account_platform,
  text,
  text
) from public, anon;

grant execute on function public.register_official_verification(
  uuid,
  public.verification_field,
  text,
  public.source_type,
  text,
  text,
  timestamptz,
  timestamptz,
  timestamptz,
  uuid,
  public.account_platform,
  text,
  text
) to authenticated, service_role;

alter table public.official_verification_actions enable row level security;

create policy "reviewers read official verification actions"
on public.official_verification_actions for select
to authenticated
using (private.is_reviewer());

grant select on public.official_verification_actions to authenticated;
grant all on public.official_verification_actions to service_role;
