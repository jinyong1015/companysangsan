create or replace function public.rpc_record_product_price_upload(
  p_secret text,
  p_file_name text default null,
  p_total_count integer default 0,
  p_inserted_count integer default 0,
  p_updated_count integer default 0,
  p_unchanged_count integer default 0,
  p_error_count integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
declare
  upload_id uuid;
begin
  perform private.assert_product_prices_secret(p_secret);

  insert into public.product_price_uploads(
    file_name, total_count, inserted_count, updated_count, unchanged_count, error_count
  ) values (
    p_file_name,
    greatest(coalesce(p_total_count, 0), 0),
    greatest(coalesce(p_inserted_count, 0), 0),
    greatest(coalesce(p_updated_count, 0), 0),
    greatest(coalesce(p_unchanged_count, 0), 0),
    greatest(coalesce(p_error_count, 0), 0)
  )
  returning id into upload_id;

  return jsonb_build_object('upload_id', upload_id, 'ok', true);
end;
$$;

revoke all on function public.rpc_record_product_price_upload(text, text, integer, integer, integer, integer, integer) from public;
grant execute on function public.rpc_record_product_price_upload(text, text, integer, integer, integer, integer, integer) to anon, authenticated, service_role;
