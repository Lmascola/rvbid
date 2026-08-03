create or replace function public.admin_claim_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'admin_exists', exists (select 1 from public.user_roles where role = 'admin'),
    'eligible', (
      not exists (select 1 from public.user_roles where role = 'admin')
      and auth.uid() is not null
      and auth.uid() = (select p.id from public.profiles p order by p.created_at asc, p.id asc limit 1)
    ),
    'eligible_email', case
      when exists (select 1 from public.user_roles where role = 'admin') then null
      else (select p.email from public.profiles p order by p.created_at asc, p.id asc limit 1)
    end
  );
$$;

create or replace function public.claim_admin()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_first uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if exists (select 1 from public.user_roles where role = 'admin') then
    raise exception 'An administrator already exists for this platform.';
  end if;
  select p.id into v_first from public.profiles p order by p.created_at asc, p.id asc limit 1;
  if v_first is null or v_first <> auth.uid() then
    raise exception 'Only the first registered account can claim administrator access.';
  end if;
  insert into public.user_roles (user_id, role) values (auth.uid(), 'admin') on conflict do nothing;
  return jsonb_build_object('ok', true);
end; $$;

revoke all on function public.admin_claim_status() from public, anon;
revoke all on function public.claim_admin() from public, anon;
grant execute on function public.admin_claim_status() to authenticated;
grant execute on function public.claim_admin() to authenticated;