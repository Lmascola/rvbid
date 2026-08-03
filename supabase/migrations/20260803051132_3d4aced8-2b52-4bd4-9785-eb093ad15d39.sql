-- PROFILES: split names
alter table public.profiles
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '';

update public.profiles
  set first_name = coalesce(nullif(split_part(full_name,' ',1),''), first_name),
      last_name = coalesce(nullif(substring(full_name from position(' ' in full_name)+1),''), last_name)
  where full_name <> '' and first_name = '';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_full text; v_first text; v_last text;
begin
  v_full := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '');
  v_first := coalesce(nullif(new.raw_user_meta_data->>'first_name',''), split_part(v_full,' ',1));
  v_last := coalesce(nullif(new.raw_user_meta_data->>'last_name',''),
                     nullif(substring(v_full from position(' ' in v_full)+1),''), '');
  insert into public.profiles (id, email, full_name, first_name, last_name, alias)
  values (new.id, coalesce(new.email,''), v_full, coalesce(v_first,''), coalesce(v_last,''), public.gen_alias())
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end; $$;

-- LISTINGS: paid vehicle report + bidder visibility for sold listings
alter table public.listings
  add column if not exists report_available boolean not null default true,
  add column if not exists report_price numeric(10,2) not null default 39.00,
  add column if not exists report_url text default '',
  add column if not exists bid_visibility text not null default 'all';

grant select (report_available, report_price, bid_visibility) on public.listings to anon, authenticated;

-- BIDS: allow team-posted bids with a chosen public name (already supported via alias/source)
-- read helper honouring per-listing visibility
create or replace function public.listing_bids(_listing_id uuid)
returns table (id uuid, alias text, amount numeric, source text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_mode text; v_status text;
begin
  select l.bid_visibility, l.status into v_mode, v_status from public.listings l where l.id = _listing_id;
  if v_mode is null then return; end if;
  if v_status = 'sold' and v_mode = 'hidden' then
    return;
  elsif v_status = 'sold' and v_mode = 'winner_only' then
    return query select b.id, b.alias, b.amount, b.source, b.created_at from public.bids b
      where b.listing_id = _listing_id order by b.amount desc, b.created_at asc limit 1;
  else
    return query select b.id, b.alias, b.amount, b.source, b.created_at from public.bids b
      where b.listing_id = _listing_id order by b.amount desc, b.created_at asc;
  end if;
end; $$;
grant execute on function public.listing_bids(uuid) to anon, authenticated;

-- team-posted bid, anonymous by default
create or replace function public.admin_place_bid(_listing_id uuid, _amount numeric, _alias text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_alias text;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Team members only.'; end if;
  v_alias := coalesce(nullif(trim(_alias),''), public.gen_alias());
  insert into public.bids (listing_id, bidder_id, alias, amount, source)
  values (_listing_id, null, v_alias, _amount, 'team');
  update public.listings
    set current_bid = greatest(current_bid, _amount), bid_count = bid_count + 1, updated_at = now()
    where id = _listing_id;
  return jsonb_build_object('ok', true, 'alias', v_alias);
end; $$;
grant execute on function public.admin_place_bid(uuid, numeric, text) to authenticated;

-- full listing rows (incl. VIN) for the team back office
create or replace function public.admin_listings()
returns setof public.listings language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Team members only.'; end if;
  return query select * from public.listings order by status, queue_order, created_at desc;
end; $$;
grant execute on function public.admin_listings() to authenticated;

-- DEPOSIT INTENTS: user presses Send, backend watches the chain
create table if not exists public.deposit_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null,
  currency text not null default 'USDT',
  network text not null default '',
  address text not null,
  qr_url text default '',
  status text not null default 'awaiting',
  detected_tx text default '',
  detected_amount numeric(14,2),
  credited_at timestamptz,
  expires_at timestamptz not null default now() + interval '2 hours',
  created_at timestamptz not null default now()
);
grant select, insert on public.deposit_intents to authenticated;
grant all on public.deposit_intents to service_role;
alter table public.deposit_intents enable row level security;
create policy "own intents read" on public.deposit_intents for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin intents" on public.deposit_intents for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
grant update, delete on public.deposit_intents to authenticated;

create or replace function public.create_deposit_intent(_amount numeric, _currency text)
returns public.deposit_intents language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_profile public.profiles%rowtype;
        v_addr public.deposit_addresses%rowtype; v_row public.deposit_intents;
begin
  if v_uid is null then raise exception 'Sign in first.'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.kyc_status <> 'approved' then
    raise exception 'Your account must be verified and approved before you can fund your wallet.';
  end if;
  if coalesce(_amount,0) <= 0 then raise exception 'Enter the amount you want to deposit.'; end if;
  select * into v_addr from public.deposit_addresses
    where active and currency = _currency order by created_at limit 1;
  if v_addr.id is null then
    raise exception 'No deposit address is configured for % yet. Our team is on it.', _currency;
  end if;
  update public.deposit_intents set status = 'expired'
    where user_id = v_uid and status = 'awaiting';
  insert into public.deposit_intents (user_id, amount, currency, network, address, qr_url)
  values (v_uid, _amount, _currency, v_addr.network, v_addr.address, coalesce(v_addr.qr_url,''))
  returning * into v_row;
  return v_row;
end; $$;
grant execute on function public.create_deposit_intent(numeric, text) to authenticated;

-- credit an intent (called by the backend watcher with service role, or by the team)
create or replace function public.credit_deposit_intent(_intent_id uuid, _tx text, _amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_i public.deposit_intents;
begin
  if auth.uid() is not null and not public.has_role(auth.uid(),'admin') then
    raise exception 'Team members only.';
  end if;
  select * into v_i from public.deposit_intents where id = _intent_id for update;
  if v_i.id is null then raise exception 'Deposit not found.'; end if;
  if v_i.status = 'credited' then return jsonb_build_object('ok', true, 'already', true); end if;
  update public.deposit_intents
    set status = 'credited', detected_tx = coalesce(_tx,''),
        detected_amount = coalesce(_amount, v_i.amount), credited_at = now()
    where id = _intent_id;
  insert into public.deposits (user_id, amount, currency, tx_hash, status, note)
    values (v_i.user_id, coalesce(_amount, v_i.amount), v_i.currency, coalesce(_tx,''), 'credited', 'Auto-detected on-chain deposit');
  update public.profiles set balance = balance + coalesce(_amount, v_i.amount) where id = v_i.user_id;
  insert into public.transactions (user_id, kind, amount, description)
    values (v_i.user_id, 'deposit', coalesce(_amount, v_i.amount), v_i.currency || ' deposit credited');
  return jsonb_build_object('ok', true);
end; $$;
grant execute on function public.credit_deposit_intent(uuid, text, numeric) to authenticated;

-- PAID VEHICLE HISTORY REPORTS
create table if not exists public.report_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  amount numeric(10,2) not null,
  status text not null default 'paid',
  report_url text default '',
  created_at timestamptz not null default now(),
  unique (user_id, listing_id)
);
grant select on public.report_orders to authenticated;
grant insert, update, delete on public.report_orders to authenticated;
grant all on public.report_orders to service_role;
alter table public.report_orders enable row level security;
create policy "own report orders" on public.report_orders for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin report orders" on public.report_orders for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.purchase_vehicle_report(_listing_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_p public.profiles%rowtype; v_l public.listings%rowtype;
begin
  if v_uid is null then raise exception 'Sign in first.'; end if;
  select * into v_p from public.profiles where id = v_uid for update;
  if v_p.kyc_status <> 'approved' then raise exception 'Your account is pending verification.'; end if;
  select * into v_l from public.listings where id = _listing_id;
  if v_l.id is null or not v_l.report_available then raise exception 'No report is available for this RV.'; end if;
  if exists (select 1 from public.report_orders where user_id = v_uid and listing_id = _listing_id) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  if (v_p.balance - v_p.locked) < v_l.report_price then
    raise exception 'Not enough available wallet balance for the % report.', v_l.report_price;
  end if;
  update public.profiles set balance = balance - v_l.report_price where id = v_uid;
  insert into public.report_orders (user_id, listing_id, amount, report_url)
    values (v_uid, _listing_id, v_l.report_price, coalesce(v_l.report_url,''));
  insert into public.transactions (user_id, kind, amount, description)
    values (v_uid, 'report_purchase', -v_l.report_price, 'Vehicle history report: ' || v_l.title);
  return jsonb_build_object('ok', true, 'vin', v_l.vin, 'report_url', coalesce(v_l.report_url,''));
end; $$;
grant execute on function public.purchase_vehicle_report(uuid) to authenticated;

create or replace function public.my_vehicle_report(_listing_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when exists (
      select 1 from public.report_orders o where o.user_id = auth.uid() and o.listing_id = _listing_id
    ) then jsonb_build_object('owned', true, 'vin', l.vin, 'report_url', coalesce(l.report_url,''))
    else jsonb_build_object('owned', false) end
  from public.listings l where l.id = _listing_id;
$$;
grant execute on function public.my_vehicle_report(uuid) to authenticated;

-- TEAM ACCESS: grant admin by email (for the repository owner)
create or replace function public.grant_admin_by_email(_email text)
returns text language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Team members only.'; end if;
  select id into v_id from auth.users where lower(email) = lower(_email);
  if v_id is null then raise exception 'No account found for %.', _email; end if;
  insert into public.user_roles (user_id, role) values (v_id, 'admin') on conflict do nothing;
  return 'ok';
end; $$;
grant execute on function public.grant_admin_by_email(text) to authenticated;

-- PUBLIC COPY: "admin" -> "team"
update public.faqs set
  question = replace(replace(replace(question,'Admin','our team'),'admin','our team'),'administrator','our team'),
  answer = replace(replace(replace(answer,'Admin','Our team'),'admin','our team'),'administrator','our team');
update public.legal_pages set
  content = replace(replace(replace(content,'Admin','Our team'),'admin','our team'),'administrator','our team');

insert into public.site_settings (key, value) values ('report_price','39.00')
  on conflict (key) do nothing;