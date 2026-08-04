-- NOTIFICATIONS -------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text not null default '',
  listing_id uuid references public.listings(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications read" on public.notifications for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own notifications update" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

-- SHARED RECOMPUTE ----------------------------------------------------
create or replace function public.recompute_listing_bids(_listing_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_top record; v_count int; v_max numeric; v_status text;
begin
  select status into v_status from public.listings where id = _listing_id;
  select count(*)::int, coalesce(max(amount),0) into v_count, v_max
    from public.bids where listing_id = _listing_id;
  select * into v_top from public.bids where listing_id = _listing_id
    order by amount desc, created_at desc limit 1;

  update public.listings set
    current_bid = v_max,
    bid_count = v_count,
    winner_alias = case when v_status = 'sold' then v_top.alias else winner_alias end,
    winner_id = case when v_status = 'sold' then v_top.bidder_id else winner_id end,
    sold_price = case when v_status = 'sold' then coalesce(v_top.amount, v_max) else sold_price end,
    updated_at = now()
  where id = _listing_id;
end; $$;
grant execute on function public.recompute_listing_bids(uuid) to authenticated;

-- ADMIN: EDIT A BID (amount, alias, timestamp) ------------------------
create or replace function public.admin_update_bid(
  _bid_id uuid,
  _amount numeric default null,
  _alias text default null,
  _created_at timestamptz default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_bid public.bids%rowtype;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Team members only.'; end if;
  select * into v_bid from public.bids where id = _bid_id;
  if v_bid.id is null then raise exception 'Bid not found.'; end if;

  update public.bids set
    amount = coalesce(_amount, amount),
    alias = coalesce(nullif(trim(_alias),''), alias),
    created_at = coalesce(_created_at, created_at)
  where id = _bid_id;

  perform public.recompute_listing_bids(v_bid.listing_id);
  return jsonb_build_object('ok', true);
end; $$;
grant execute on function public.admin_update_bid(uuid, numeric, text, timestamptz) to authenticated;

-- ADMIN: PLACE A BID AT A CHOSEN TIME --------------------------------
create or replace function public.admin_place_bid(
  _listing_id uuid,
  _amount numeric,
  _alias text default null,
  _created_at timestamptz default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_alias text;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Team members only.'; end if;
  v_alias := coalesce(nullif(trim(_alias),''), public.gen_alias());
  insert into public.bids (listing_id, bidder_id, alias, amount, source, created_at)
  values (_listing_id, null, v_alias, _amount, 'team', coalesce(_created_at, now()));
  perform public.recompute_listing_bids(_listing_id);
  return jsonb_build_object('ok', true, 'alias', v_alias);
end; $$;
grant execute on function public.admin_place_bid(uuid, numeric, text, timestamptz) to authenticated;

-- ADMIN: DELETE A BID (recompute via shared helper) -------------------
create or replace function public.admin_delete_bid(_bid_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_listing uuid;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Team members only.'; end if;
  select listing_id into v_listing from public.bids where id = _bid_id;
  if v_listing is null then raise exception 'Bid not found.'; end if;
  delete from public.bids where id = _bid_id;
  perform public.recompute_listing_bids(v_listing);
  return jsonb_build_object('ok', true);
end; $$;
grant execute on function public.admin_delete_bid(uuid) to authenticated;

-- ADMIN: EDIT WHEN AN AUCTION CLOSED ---------------------------------
create or replace function public.admin_set_close_time(_listing_id uuid, _sold_at timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Team members only.'; end if;
  update public.listings set sold_at = _sold_at, updated_at = now() where id = _listing_id;
  perform public.recompute_listing_bids(_listing_id);
  return jsonb_build_object('ok', true);
end; $$;
grant execute on function public.admin_set_close_time(uuid, timestamptz) to authenticated;

-- OUTBID NOTIFICATIONS ------------------------------------------------
create or replace function public.notify_outbid()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_prev record; v_title text;
begin
  select b.bidder_id, b.amount into v_prev
    from public.bids b
    where b.listing_id = new.listing_id
      and b.id <> new.id
      and b.bidder_id is not null
      and b.amount < new.amount
    order by b.amount desc, b.created_at desc
    limit 1;

  if v_prev.bidder_id is not null and v_prev.bidder_id is distinct from new.bidder_id then
    select 'You were outbid on ' || l.title into v_title from public.listings l where l.id = new.listing_id;
    insert into public.notifications (user_id, kind, title, body, listing_id)
    values (
      v_prev.bidder_id,
      'outbid',
      coalesce(v_title, 'You were outbid'),
      'The leading bid is now $' || trim(to_char(new.amount, 'FM999999999.00'))
        || '. Your $' || trim(to_char(v_prev.amount, 'FM999999999.00'))
        || ' has been released back to your available balance.',
      new.listing_id
    );
  end if;
  return new;
end; $$;

drop trigger if exists bids_notify_outbid on public.bids;
create trigger bids_notify_outbid after insert on public.bids
  for each row execute function public.notify_outbid();

-- Backfill: sold listings tally with their bid history
do $$
declare v_id uuid;
begin
  for v_id in select id from public.listings where status = 'sold' loop
    perform public.recompute_listing_bids(v_id);
  end loop;
end $$;