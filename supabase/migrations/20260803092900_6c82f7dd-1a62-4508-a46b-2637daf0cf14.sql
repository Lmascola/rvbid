create or replace function public.admin_delete_bid(_bid_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_listing uuid;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Team members only.'; end if;
  select listing_id into v_listing from public.bids where id = _bid_id;
  if v_listing is null then raise exception 'Bid not found.'; end if;
  delete from public.bids where id = _bid_id;
  update public.listings l
    set bid_count = (select count(*) from public.bids b where b.listing_id = l.id),
        current_bid = coalesce((select max(b.amount) from public.bids b where b.listing_id = l.id), l.starting_bid),
        updated_at = now()
    where l.id = v_listing;
  return jsonb_build_object('ok', true);
end; $$;

revoke all on function public.admin_delete_bid(uuid) from public, anon;
grant execute on function public.admin_delete_bid(uuid) to authenticated;