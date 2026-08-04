-- Canonical locked-funds calculation: a member's locked amount is the sum of the
-- bids they are currently leading on auctions that are still live. Anything else
-- (outbid, sold, cancelled, deleted bid) is released automatically.
create or replace function public.locked_for_user(_user_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(t.amount), 0)::numeric
  from (
    select distinct on (b.listing_id) b.listing_id, b.bidder_id, b.amount
    from public.bids b
    join public.listings l on l.id = b.listing_id
    where l.status = 'live'
    order by b.listing_id, b.amount desc, b.created_at desc
  ) t
  where t.bidder_id = _user_id;
$$;

create or replace function public.sync_locked_funds(_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _user_id is null then return; end if;
  update public.profiles
     set locked = public.locked_for_user(_user_id)
   where id = _user_id
     and locked is distinct from public.locked_for_user(_user_id);
end; $$;

create or replace function public.sync_locked_for_listing(_listing_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
  for v_uid in
    select distinct bidder_id from public.bids
     where listing_id = _listing_id and bidder_id is not null
  loop
    perform public.sync_locked_funds(v_uid);
  end loop;
end; $$;

grant execute on function public.locked_for_user(uuid) to authenticated;
grant execute on function public.sync_locked_funds(uuid) to authenticated;
grant execute on function public.sync_locked_for_listing(uuid) to authenticated;

-- Trigger: any bid change re-syncs everyone who has bid on that auction.
create or replace function public.bids_sync_locked()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_locked_for_listing(coalesce(new.listing_id, old.listing_id));
  if tg_op = 'UPDATE' and new.listing_id is distinct from old.listing_id then
    perform public.sync_locked_for_listing(old.listing_id);
  end if;
  return null;
end; $$;

drop trigger if exists bids_sync_locked_trg on public.bids;
create trigger bids_sync_locked_trg
after insert or update or delete on public.bids
for each row execute function public.bids_sync_locked();

-- Trigger: closing, cancelling or re-opening an auction releases/relocks funds.
create or replace function public.listings_sync_locked()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    perform public.sync_locked_for_listing(new.id);
  end if;
  return null;
end; $$;

drop trigger if exists listings_sync_locked_trg on public.listings;
create trigger listings_sync_locked_trg
after update on public.listings
for each row execute function public.listings_sync_locked();

-- place_bid no longer does its own lock arithmetic; the trigger owns it.
create or replace function public.place_bid(_listing_id uuid, _amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_listing public.listings%rowtype;
  v_alias text;
begin
  if v_uid is null then raise exception 'You must be signed in to bid.'; end if;
  select * into v_profile from public.profiles where id = v_uid for update;
  if v_profile.kyc_status <> 'approved' then raise exception 'Your account is pending verification.'; end if;
  select * into v_listing from public.listings where id = _listing_id for update;
  if v_listing.id is null then raise exception 'Auction not found.'; end if;
  if v_listing.status <> 'live' or v_listing.ends_at <= now() then raise exception 'This auction has ended.'; end if;
  if _amount <= v_listing.current_bid then
    raise exception 'Your bid must be higher than the current bid.';
  end if;

  -- Available funds ignore any lock this member already holds on THIS auction,
  -- because placing a higher bid replaces that lock rather than adding to it.
  if (v_profile.balance - v_profile.locked
      + coalesce((select b.amount from public.bids b
                   where b.listing_id = _listing_id and b.bidder_id = v_uid
                   order by b.amount desc, b.created_at desc limit 1), 0)
      ) < _amount then
    raise exception 'Insufficient available wallet balance. You can only bid up to your available funds.';
  end if;

  v_alias := case when v_profile.is_anonymous then v_profile.alias
                  else coalesce(nullif(v_profile.full_name,''), v_profile.alias) end;

  insert into public.bids (listing_id, bidder_id, alias, amount, source)
  values (_listing_id, v_uid, v_alias, _amount, 'user');

  update public.listings set current_bid = _amount, bid_count = bid_count + 1, updated_at = now()
    where id = _listing_id;

  perform public.sync_locked_for_listing(_listing_id);

  return jsonb_build_object('ok', true, 'amount', _amount, 'alias', v_alias);
end; $$;

-- Closing an auction: charge the winner, then let the sync release all locks.
create or replace function public.close_expired_auctions()
returns int language plpgsql security definer set search_path = public as $$
declare v_l record; v_top record; v_count int := 0;
begin
  for v_l in select * from public.listings where status = 'live' and ends_at is not null and ends_at <= now() loop
    select * into v_top from public.bids where listing_id = v_l.id order by amount desc, created_at asc limit 1;

    update public.listings set
      status = 'sold', sold_at = now(),
      sold_price = coalesce(v_top.amount, v_l.current_bid),
      winner_alias = v_top.alias, winner_id = v_top.bidder_id, updated_at = now()
      where id = v_l.id;

    if v_top.id is not null and v_top.bidder_id is not null then
      update public.profiles
        set balance = greatest(balance - v_top.amount, 0)
        where id = v_top.bidder_id;
      insert into public.transactions (user_id, kind, amount, description)
        values (v_top.bidder_id, 'auction_win', -v_top.amount, 'Won auction: ' || v_l.title);
    end if;

    perform public.sync_locked_for_listing(v_l.id);

    update public.site_settings set value = ((value)::int + 1)::text, updated_at = now()
      where key in ('completed_auctions','rvs_sold');

    update public.listings set status = 'live', ends_at = now() + interval '12 hours'
      where id = (select id from public.listings where status = 'queued' order by queue_order asc, created_at asc limit 1);
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;

-- One-off correction of every existing account.
update public.profiles p set locked = public.locked_for_user(p.id)
 where p.locked is distinct from public.locked_for_user(p.id);
