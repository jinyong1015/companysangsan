-- 관리자 비밀번호 해시를 Supabase private.app_config 에 저장
-- 값 설정 예:
--   insert into private.app_config(key, value) values ('admin_password_hash', 'scrypt:...')
--   on conflict (key) do update set value = excluded.value;

create or replace function public.rpc_get_admin_password_hash(p_secret text)
returns text
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
declare
  v_hash text;
begin
  perform private.assert_product_prices_secret(p_secret);
  select value into v_hash
  from private.app_config
  where key = 'admin_password_hash';
  return v_hash;
end;
$$;

revoke all on function public.rpc_get_admin_password_hash(text) from public;
grant execute on function public.rpc_get_admin_password_hash(text) to anon, authenticated, service_role;
