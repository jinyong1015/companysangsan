-- 제품 단가 관리 (로컬 참고용 — 원격 Supabase에는 MCP apply_migration으로 적용됨)

create schema if not exists private;

create table if not exists private.app_secrets (
  key text primary key,
  value text not null
);

create or replace function private.assert_product_prices_secret(p_secret text)
returns void
language plpgsql
security definer
set search_path to 'private'
as $$
declare
  expected text;
begin
  select value into expected
  from private.app_secrets
  where key = 'product_prices_rpc';

  if expected is null or p_secret is distinct from expected then
    raise exception 'invalid secret' using errcode = '42501';
  end if;
end;
$$;

revoke all on schema private from public, anon, authenticated;
revoke all on table private.app_secrets from public, anon, authenticated;

create table if not exists public.product_prices (
  id uuid primary key default gen_random_uuid(),
  part_number text not null,
  unit_price numeric(18, 4) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_prices_part_number_key unique (part_number),
  constraint product_prices_unit_price_non_negative check (unit_price >= 0)
);

create index if not exists product_prices_updated_at_idx
  on public.product_prices (updated_at desc);

create table if not exists public.product_price_uploads (
  id uuid primary key default gen_random_uuid(),
  uploaded_at timestamptz not null default now(),
  file_name text,
  total_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  unchanged_count integer not null default 0,
  error_count integer not null default 0
);

create or replace function public.set_product_prices_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_product_prices_updated_at on public.product_prices;
create trigger trg_product_prices_updated_at
before update on public.product_prices
for each row execute function public.set_product_prices_updated_at();

alter table public.product_prices enable row level security;
alter table public.product_price_uploads enable row level security;

drop policy if exists product_prices_select_all on public.product_prices;
create policy product_prices_select_all
  on public.product_prices
  for select
  to anon, authenticated
  using (true);

drop policy if exists product_price_uploads_select_all on public.product_price_uploads;
create policy product_price_uploads_select_all
  on public.product_price_uploads
  for select
  to anon, authenticated
  using (true);

-- INSERT/UPDATE/DELETE 는 RLS로 차단. 쓰기는 SECURITY DEFINER RPC + 시크릿만 허용.

create or replace function public.rpc_upsert_product_prices(
  p_secret text,
  p_rows jsonb,
  p_file_name text default null,
  p_write_history boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
declare
  r jsonb;
  v_part text;
  v_price numeric(18,4);
  v_existing numeric(18,4);
  inserted_count integer := 0;
  updated_count integer := 0;
  unchanged_count integer := 0;
  upload_id uuid;
begin
  perform private.assert_product_prices_secret(p_secret);

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a json array';
  end if;

  for r in select * from jsonb_array_elements(p_rows)
  loop
    v_part := nullif(btrim(coalesce(r->>'part_number', '')), '');
    begin
      v_price := round((r->>'unit_price')::numeric, 4);
    exception when others then
      raise exception 'invalid unit_price for %', coalesce(v_part, '?');
    end;

    if v_part is null then
      raise exception 'part_number is required';
    end if;
    if v_price is null or v_price < 0 then
      raise exception 'unit_price must be >= 0 for %', v_part;
    end if;

    select unit_price into v_existing
    from public.product_prices
    where part_number = v_part
    for update;

    if not found then
      begin
        insert into public.product_prices(part_number, unit_price)
        values (v_part, v_price);
        inserted_count := inserted_count + 1;
      exception when unique_violation then
        select unit_price into v_existing
        from public.product_prices
        where part_number = v_part
        for update;
        if v_existing is distinct from v_price then
          update public.product_prices
          set unit_price = v_price
          where part_number = v_part;
          updated_count := updated_count + 1;
        else
          unchanged_count := unchanged_count + 1;
        end if;
      end;
    elsif v_existing is distinct from v_price then
      update public.product_prices
      set unit_price = v_price
      where part_number = v_part;
      updated_count := updated_count + 1;
    else
      unchanged_count := unchanged_count + 1;
    end if;
  end loop;

  if coalesce(p_write_history, true) then
    insert into public.product_price_uploads(
      file_name, total_count, inserted_count, updated_count, unchanged_count, error_count
    ) values (
      p_file_name,
      inserted_count + updated_count + unchanged_count,
      inserted_count,
      updated_count,
      unchanged_count,
      0
    )
    returning id into upload_id;
  end if;

  return jsonb_build_object(
    'upload_id', upload_id,
    'inserted', inserted_count,
    'updated', updated_count,
    'unchanged', unchanged_count
  );
end;
$$;

create or replace function public.rpc_update_product_price(
  p_secret text,
  p_id uuid,
  p_unit_price numeric
)
returns product_prices
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
declare
  row public.product_prices;
begin
  perform private.assert_product_prices_secret(p_secret);
  if p_unit_price is null or p_unit_price < 0 then
    raise exception 'unit_price must be >= 0';
  end if;
  update public.product_prices
  set unit_price = round(p_unit_price, 4)
  where id = p_id
  returning * into row;
  if row.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  return row;
end;
$$;

create or replace function public.rpc_delete_product_price(
  p_secret text,
  p_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
begin
  perform private.assert_product_prices_secret(p_secret);
  delete from public.product_prices where id = p_id;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  return jsonb_build_object('ok', true, 'id', p_id);
end;
$$;

grant execute on function public.rpc_upsert_product_prices(text, jsonb, text, boolean) to anon, authenticated, service_role;
grant execute on function public.rpc_update_product_price(text, uuid, numeric) to anon, authenticated, service_role;
grant execute on function public.rpc_delete_product_price(text, uuid) to anon, authenticated, service_role;

-- private.app_secrets 에 product_prices_rpc 값을 넣고
-- 앱 환경변수 PRODUCT_PRICES_RPC_SECRET 과 동일하게 맞춥니다.
