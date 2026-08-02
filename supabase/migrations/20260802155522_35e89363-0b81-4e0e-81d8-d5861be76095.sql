
-- ROLES ---------------------------------------------------------------
create type public.app_role as enum ('admin','user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own roles readable" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- PROFILES ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  dob date,
  email text not null default '',
  phone text default '',
  state text default '',
  zip text default '',
  alias text not null,
  is_anonymous boolean not null default true,
  kyc_status text not null default 'pending',
  kyc_id_url text,
  kyc_selfie_url text,
  balance numeric(14,2) not null default 0,
  locked numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "admin profile update" on public.profiles for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());

create or replace function public.gen_alias() returns text language sql volatile as $$
  select 'X' || lpad((floor(random()*9000)+1000)::int::text, 4, '0');
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, alias)
  values (new.id, coalesce(new.email,''), coalesce(new.raw_user_meta_data->>'full_name',''), public.gen_alias());
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- LISTINGS ------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  year int,
  make text,
  model text,
  vin text not null default '',
  vin_masked text generated always as ('•••••••••••' || right(vin, 6)) stored,
  mileage int,
  sleeps int,
  length_ft int,
  rv_class text,
  location text,
  description text default '',
  images text[] not null default '{}',
  starting_bid numeric(14,2) not null default 0,
  current_bid numeric(14,2) not null default 0,
  bid_count int not null default 0,
  status text not null default 'live',
  ends_at timestamptz,
  sold_at timestamptz,
  sold_price numeric(14,2),
  winner_alias text,
  winner_id uuid,
  queue_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select (id,title,year,make,model,vin_masked,mileage,sleeps,length_ft,rv_class,location,description,images,starting_bid,current_bid,bid_count,status,ends_at,sold_at,sold_price,winner_alias,queue_order,created_at,updated_at)
  on public.listings to anon, authenticated;
grant insert, update, delete on public.listings to authenticated;
grant all on public.listings to service_role;
alter table public.listings enable row level security;
create policy "listings public read" on public.listings for select to anon, authenticated using (true);
create policy "admins manage listings" on public.listings for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.get_listing_vin(_listing_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.kyc_status = 'approved'
  ) then (select l.vin from public.listings l where l.id = _listing_id) else null end;
$$;

-- BIDS ----------------------------------------------------------------
create table public.bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  bidder_id uuid references auth.users(id) on delete set null,
  alias text not null,
  amount numeric(14,2) not null,
  source text not null default 'user',
  created_at timestamptz not null default now()
);
grant select on public.bids to anon, authenticated;
grant all on public.bids to service_role;
alter table public.bids enable row level security;
create policy "bids public read" on public.bids for select to anon, authenticated using (true);
create policy "admins manage bids" on public.bids for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
grant insert, update, delete on public.bids to authenticated;

-- WALLET --------------------------------------------------------------
create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null,
  currency text not null default 'USDT',
  tx_hash text default '',
  status text not null default 'pending',
  note text default '',
  created_at timestamptz not null default now()
);
grant select, insert on public.deposits to authenticated;
grant update, delete on public.deposits to authenticated;
grant all on public.deposits to service_role;
alter table public.deposits enable row level security;
create policy "own deposits" on public.deposits for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "create own deposit" on public.deposits for insert to authenticated with check (user_id = auth.uid());
create policy "admin deposits" on public.deposits for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null,
  currency text not null default 'USDT',
  destination text not null default '',
  status text not null default 'pending',
  note text default '',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.withdrawals to authenticated;
grant all on public.withdrawals to service_role;
alter table public.withdrawals enable row level security;
create policy "own withdrawals" on public.withdrawals for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "create own withdrawal" on public.withdrawals for insert to authenticated with check (user_id = auth.uid());
create policy "admin withdrawals" on public.withdrawals for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  amount numeric(14,2) not null,
  description text default '',
  created_at timestamptz not null default now()
);
grant select on public.transactions to authenticated;
grant insert, update, delete on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "own transactions" on public.transactions for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin transactions" on public.transactions for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.deposit_addresses (
  id uuid primary key default gen_random_uuid(),
  currency text not null,
  network text not null default '',
  address text not null,
  qr_url text default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.deposit_addresses to authenticated;
grant insert, update, delete on public.deposit_addresses to authenticated;
grant all on public.deposit_addresses to service_role;
alter table public.deposit_addresses enable row level security;
create policy "members read addresses" on public.deposit_addresses for select to authenticated using (true);
create policy "admin addresses" on public.deposit_addresses for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- CONTENT -------------------------------------------------------------
create table public.site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;
grant all on public.site_settings to service_role;
alter table public.site_settings enable row level security;
create policy "settings public read" on public.site_settings for select to anon, authenticated using (true);
create policy "admin settings" on public.site_settings for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.legal_pages (
  slug text primary key,
  title text not null,
  content text not null default '',
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);
grant select on public.legal_pages to anon, authenticated;
grant insert, update, delete on public.legal_pages to authenticated;
grant all on public.legal_pages to service_role;
alter table public.legal_pages enable row level security;
create policy "legal public read" on public.legal_pages for select to anon, authenticated using (true);
create policy "admin legal" on public.legal_pages for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  sort_order int not null default 0
);
grant select on public.faqs to anon, authenticated;
grant insert, update, delete on public.faqs to authenticated;
grant all on public.faqs to service_role;
alter table public.faqs enable row level security;
create policy "faq public read" on public.faqs for select to anon, authenticated using (true);
create policy "admin faq" on public.faqs for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- BIDDING LOGIC -------------------------------------------------------
create or replace function public.place_bid(_listing_id uuid, _amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_listing public.listings%rowtype;
  v_prev record;
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
  if (v_profile.balance - v_profile.locked) < _amount then
    raise exception 'Insufficient available wallet balance. You can only bid up to your available funds.';
  end if;

  select b.bidder_id, b.amount into v_prev from public.bids b
    where b.listing_id = _listing_id and b.bidder_id is not null
    order by b.amount desc, b.created_at desc limit 1;
  if v_prev.bidder_id is not null and v_prev.amount = v_listing.current_bid then
    update public.profiles set locked = greatest(locked - v_prev.amount, 0) where id = v_prev.bidder_id;
  end if;

  v_alias := case when v_profile.is_anonymous then v_profile.alias
                  else coalesce(nullif(v_profile.full_name,''), v_profile.alias) end;

  insert into public.bids (listing_id, bidder_id, alias, amount, source)
  values (_listing_id, v_uid, v_alias, _amount, 'user');

  update public.profiles set locked = locked + _amount where id = v_uid;
  update public.listings set current_bid = _amount, bid_count = bid_count + 1, updated_at = now()
    where id = _listing_id;

  return jsonb_build_object('ok', true, 'amount', _amount, 'alias', v_alias);
end; $$;

create or replace function public.admin_place_bid(_listing_id uuid, _amount numeric, _alias text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_alias text;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Admins only.'; end if;
  v_alias := coalesce(nullif(_alias,''), public.gen_alias());
  insert into public.bids (listing_id, bidder_id, alias, amount, source)
  values (_listing_id, null, v_alias, _amount, 'admin');
  update public.listings
    set current_bid = greatest(current_bid, _amount), bid_count = bid_count + 1, updated_at = now()
    where id = _listing_id;
  return jsonb_build_object('ok', true, 'alias', v_alias);
end; $$;

create or replace function public.close_expired_auctions()
returns int language plpgsql security definer set search_path = public as $$
declare v_l record; v_top record; v_count int := 0;
begin
  for v_l in select * from public.listings where status = 'live' and ends_at is not null and ends_at <= now() loop
    select * into v_top from public.bids where listing_id = v_l.id order by amount desc, created_at asc limit 1;
    if v_top.id is not null and v_top.bidder_id is not null then
      update public.profiles
        set balance = greatest(balance - v_top.amount, 0), locked = greatest(locked - v_top.amount, 0)
        where id = v_top.bidder_id;
      insert into public.transactions (user_id, kind, amount, description)
        values (v_top.bidder_id, 'auction_win', -v_top.amount, 'Won auction: ' || v_l.title);
    end if;
    update public.listings set
      status = 'sold', sold_at = now(),
      sold_price = coalesce(v_top.amount, v_l.current_bid),
      winner_alias = v_top.alias, winner_id = v_top.bidder_id, updated_at = now()
      where id = v_l.id;

    update public.site_settings set value = ((value)::int + 1)::text, updated_at = now()
      where key in ('completed_auctions','rvs_sold');

    update public.listings set status = 'live', ends_at = now() + interval '12 hours'
      where id = (select id from public.listings where status = 'queued' order by queue_order asc, created_at asc limit 1);
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$;

create or replace function public.bootstrap_admin()
returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if exists (select 1 from public.user_roles where role = 'admin') then
    raise exception 'An admin already exists for this platform.';
  end if;
  insert into public.user_roles (user_id, role) values (auth.uid(), 'admin') on conflict do nothing;
  return 'ok';
end; $$;

grant execute on function public.place_bid(uuid, numeric) to authenticated;
grant execute on function public.admin_place_bid(uuid, numeric, text) to authenticated;
grant execute on function public.close_expired_auctions() to anon, authenticated;
grant execute on function public.get_listing_vin(uuid) to authenticated;
grant execute on function public.bootstrap_admin() to authenticated;

-- SEED ----------------------------------------------------------------
insert into public.site_settings (key, value) values
  ('live_auctions','10'), ('completed_auctions','118'), ('rvs_sold','118'),
  ('support_email','support@rvbid.com'), ('brand_name','RVBID');

insert into public.listings (title, year, make, model, vin, mileage, sleeps, length_ft, rv_class, location, description, images, current_bid, bid_count, status, ends_at) values
('2019 Winnebago View 24V',2019,'Winnebago','View 24V','1FDXE4FS8KDC10023',41250,4,25,'Class C','Bend, OR','Used Class C diesel coach with slide-out, solar package and fresh service records.',array['/images/rv-1.jpg','/images/rv-2.jpg','/images/rv-3.jpg'],0,0,'live', now() + interval '11 hours'),
('2017 Airstream Flying Cloud 25FB',2017,'Airstream','Flying Cloud 25FB','1STFCFB25H1234567',0,4,25,'Travel Trailer','Austin, TX','Polished aluminum travel trailer, dry weight 5,400 lbs, all appliances tested.',array['/images/rv-2.jpg','/images/rv-4.jpg'],0,0,'live', now() + interval '9 hours'),
('2016 Thor Hurricane 34J',2016,'Thor','Hurricane 34J','1F66F5DY4G0A11122',58900,10,35,'Class A','Phoenix, AZ','Bunkhouse Class A gas coach with two slides and rear queen suite.',array['/images/rv-3.jpg','/images/rv-5.jpg'],0,0,'live', now() + interval '7 hours'),
('2020 Forest River Rockwood Mini Lite',2020,'Forest River','Rockwood 2511S','4X4TRLB29LD123456',0,5,26,'Travel Trailer','Boise, ID','Lightweight half-ton towable with power awning and outdoor kitchen.',array['/images/rv-4.jpg','/images/rv-1.jpg'],0,0,'live', now() + interval '6 hours'),
('2015 Tiffin Allegro Red 33AA',2015,'Tiffin','Allegro Red 33AA','4UZACWDT0FCGN1234',72400,6,34,'Class A Diesel','Ocala, FL','Freightliner chassis diesel pusher, well maintained, new tires.',array['/images/rv-5.jpg','/images/rv-6.jpg'],0,0,'live', now() + interval '5 hours'),
('2018 Jayco Greyhawk 29MV',2018,'Jayco','Greyhawk 29MV','1FDXE4FN6JDC55512',36700,7,31,'Class C','Denver, CO','Ford E-450 chassis, full-wall slide, backup camera and generator.',array['/images/rv-6.jpg','/images/rv-2.jpg'],0,0,'live', now() + interval '4 hours'),
('2014 Keystone Montana 3711FL',2014,'Keystone','Montana 3711FL','4YDF37124E1234567',0,6,38,'Fifth Wheel','Nashville, TN','Front living fifth wheel with four slides, residential fridge and fireplace.',array['/images/rv-1.jpg','/images/rv-5.jpg'],0,0,'live', now() + interval '3 hours'),
('2021 Coachmen Freelander 26DS',2021,'Coachmen','Freelander 26DS','1GB3GSCG5M1234567',19800,6,28,'Class C','Salt Lake City, UT','Low mileage Chevy chassis Class C with dinette slide and cab-over bunk.',array['/images/rv-2.jpg','/images/rv-3.jpg'],0,0,'live', now() + interval '2 hours'),
('2013 Newmar Dutch Star 4318',2013,'Newmar','Dutch Star 4318','4UZACWDU9DCFA1234',95120,4,43,'Class A Diesel','Sarasota, FL','Luxury diesel pusher, bath and a half, 450hp Cummins, aqua-hot.',array['/images/rv-3.jpg','/images/rv-6.jpg'],0,0,'live', now() + interval '90 minutes'),
('2019 Grand Design Imagine 2670MK',2019,'Grand Design','Imagine 2670MK','573TE2924K1234567',0,4,31,'Travel Trailer','Kalispell, MT','Rear kitchen travel trailer, solar prep, off-road tires, garage kept.',array['/images/rv-4.jpg','/images/rv-5.jpg'],0,0,'live', now() + interval '45 minutes');

insert into public.listings (title, year, make, model, vin, mileage, sleeps, length_ft, rv_class, location, description, images, current_bid, bid_count, status, ends_at, sold_at, sold_price, winner_alias) values
('2016 Winnebago Minnie Winnie 22R',2016,'Winnebago','Minnie Winnie 22R','1FDEE3FS0GDC33344',52300,5,24,'Class C','Reno, NV','Sold as-is used Class C.',array['/images/rv-1.jpg'],18400,27,'sold', now() - interval '1 day', now() - interval '1 day', 18400,'X4471'),
('2012 Fleetwood Bounder 33C',2012,'Fleetwood','Bounder 33C','1F65F5DY9C0A22233',81200,6,34,'Class A','Tucson, AZ','Sold as-is used Class A.',array['/images/rv-2.jpg'],21750,34,'sold', now() - interval '2 days', now() - interval '2 days', 21750,'DesertRoamer'),
('2018 Heartland Mallard M312',2018,'Heartland','Mallard M312','5SFNB3624JE123456',0,8,35,'Travel Trailer','Wichita, KS','Sold as-is used travel trailer.',array['/images/rv-3.jpg'],12900,19,'sold', now() - interval '3 days', now() - interval '3 days', 12900,'X8820'),
('2015 Itasca Sunstar 26HE',2015,'Itasca','Sunstar 26HE','1F65F5DY2F0A99887',63400,6,27,'Class A','Springfield, MO','Sold as-is used Class A.',array['/images/rv-4.jpg'],16250,22,'sold', now() - interval '4 days', now() - interval '4 days', 16250,'X1093'),
('2017 Jayco Jay Flight 28BHS',2017,'Jayco','Jay Flight 28BHS','1UJBJ0BS3H1AB1234',0,9,33,'Travel Trailer','Columbus, OH','Sold as-is used bunkhouse trailer.',array['/images/rv-5.jpg'],11400,31,'sold', now() - interval '5 days', now() - interval '5 days', 11400,'RoadHouse22'),
('2011 Tiffin Phaeton 40QTH',2011,'Tiffin','Phaeton 40QTH','4UZACWDT8BCBA5566',104300,6,40,'Class A Diesel','Mobile, AL','Sold as-is used diesel pusher.',array['/images/rv-6.jpg'],38900,44,'sold', now() - interval '6 days', now() - interval '6 days', 38900,'X6652'),
('2019 Forest River Sunseeker 2860DS',2019,'Forest River','Sunseeker 2860DS','1FDXE4FS7KDC77788',28900,7,30,'Class C','Charlotte, NC','Sold as-is used Class C.',array['/images/rv-1.jpg'],27600,29,'sold', now() - interval '7 days', now() - interval '7 days', 27600,'X2214'),
('2014 Keystone Cougar 327RES',2014,'Keystone','Cougar 327RES','4YDF32725E1122334',0,6,35,'Fifth Wheel','Billings, MT','Sold as-is used fifth wheel.',array['/images/rv-2.jpg'],14300,25,'sold', now() - interval '8 days', now() - interval '8 days', 14300,'BigSkyRider'),
('2013 Thor Chateau 31L',2013,'Thor','Chateau 31L','1FDXE4FS4DDA44455',71800,8,32,'Class C','Little Rock, AR','Sold as-is used Class C.',array['/images/rv-3.jpg'],15750,20,'sold', now() - interval '9 days', now() - interval '9 days', 15750,'X5507'),
('2020 Coachmen Apex 245BHS',2020,'Coachmen','Apex 245BHS','5ZT2AEXB4LA123456',0,7,28,'Travel Trailer','Portland, OR','Sold as-is used travel trailer.',array['/images/rv-4.jpg'],13850,26,'sold', now() - interval '10 days', now() - interval '10 days', 13850,'X3388'),
('2010 Monaco Knight 40PDQ',2010,'Monaco','Knight 40PDQ','4VZBR1D9XAC066778',118400,4,40,'Class A Diesel','Fort Worth, TX','Sold as-is used diesel coach.',array['/images/rv-5.jpg'],29900,37,'sold', now() - interval '11 days', now() - interval '11 days', 29900,'X7741'),
('2018 Winnebago Micro Minnie 2106FBS',2018,'Winnebago','Micro Minnie 2106FBS','54CTM2124J1234567',0,3,22,'Travel Trailer','Flagstaff, AZ','Sold as-is used compact trailer.',array['/images/rv-6.jpg'],10200,18,'sold', now() - interval '12 days', now() - interval '12 days', 10200,'CanyonHauler');

insert into public.faqs (question, answer, sort_order) values
('How do the 12-hour auctions work?','Every RVBID auction runs on a 12-hour "Fast Fingers" clock. Bidding opens at $0 and closes the moment the countdown hits zero. The highest bid at close wins.',1),
('Why does bidding start at $0?','Starting every auction at $0 is the catch that makes RVBID different — it lets real buyers land RVs well under market value.',2),
('Do I need funds in my wallet before bidding?','Yes. You can only bid up to your available wallet balance. If you deposit $599, you can bid $599 or less. The bid amount is locked until you are outbid or the auction closes.',3),
('Can I stay anonymous to other bidders?','Yes. Even though every member completes identity verification with us, you can choose to appear to other bidders as an anonymous ID such as X6521.',4),
('When can I see the full VIN?','Registered and verified members see the complete VIN on every listing. Visitors see a partially masked VIN until they sign up and are verified.',5),
('How fast are withdrawals?','Withdrawals are processed immediately, though the crypto network used may take 1-2 hours to confirm.',6),
('Are the RVs new?','No. Every RV on RVBID is used and sold as-is. We describe each unit in good faith and our team will help assist with any issue that arises.',7);

insert into public.legal_pages (slug, title, sort_order, content) values
('terms','Terms of Service',1,'# Terms of Service

## 1. About RVBID
RVBID is an online auction marketplace for used recreational vehicles. By creating an account you agree to these terms.

## 2. Eligibility
You must be at least 18 years old, provide accurate registration details, and complete identity verification before bidding.

## 3. Account Approval
All new accounts remain Pending until our team reviews your government ID and selfie. Bidding, deposits and withdrawals unlock after approval.

## 4. Auctions
Each auction runs for 12 hours and starts at $0. The highest bid when the countdown reaches zero wins. Bids are binding.

## 5. Wallet-Backed Bidding
You may only place a bid that is fully covered by your available wallet balance. The bid amount is locked to that auction until you are outbid or the auction closes.

## 6. Anonymity
Bidders may choose to remain anonymous to other bidders. Your legal identity is still verified by RVBID and is never displayed to other members unless you choose to show your name.

## 7. Fees
RVBID does not charge a bidding fee. Any transport, titling or state fees are the responsibility of the buyer.

## 8. RV Condition and As-Is Sales
All RVs are sold used and as-is without warranty, express or implied. We provide descriptions and photos in good faith, and we would help assist with any issue that arises.

## 9. Prohibited Conduct
Bid manipulation, multiple accounts, fraudulent deposits and misrepresentation are grounds for immediate suspension.

## 10. Changes
We may update these terms. Continued use of RVBID means you accept the updated terms.'),
('privacy','Privacy Policy',2,'# Privacy Policy

## Information We Collect
We collect your name, date of birth, email, phone number, state, ZIP code, government-issued ID and a selfie for identity verification, plus wallet and bidding activity.

## How We Use It
Your information is used to verify your identity, protect the auction from fraud, process wallet activity, and contact you about auctions you take part in.

## Anonymity to Other Bidders
Other bidders never see your legal identity unless you turn anonymity off. Anonymous members appear only as a generated ID such as X6521.

## Sharing
We do not sell your data. We share information only with service providers who help us operate the platform, or where required by law.

## Storage and Security
Verification documents are stored in encrypted private storage and are accessible only to authorised RVBID review staff.

## Your Rights
You may request a copy or deletion of your personal data at any time by contacting support@rvbid.com. Some records are retained where required for legal or accounting reasons.'),
('wallet','Wallet Policy',3,'# Wallet Policy

## 1. Funding Your Wallet
Wallet funding is by cryptocurrency deposit. Your dashboard shows the deposit address and QR code assigned to your account by our admin team.

## 2. Crediting Deposits
Deposits are credited after network confirmation and admin verification. Always send only the stated asset on the stated network.

## 3. Bidding Power
Your bidding power equals your available wallet balance. You cannot place a bid larger than the funds you hold. For example, if you deposit $599 you may bid $599 or less.

## 4. Locked Funds
When you place a bid, that amount is locked in the auction. The lock is released when the auction expires or when another bidder outbids you. When you win an auction, the winning bid is deducted from your balance.

## 5. Withdrawals
You may request a withdrawal of your wallet balance through your Dashboard. Withdrawals are processed by the admin team to your original deposit method or a verified address. Withdrawals are processed immediately but may take 1-2 hours depending on the crypto network used for the transaction.

## 6. Accuracy
You are responsible for the accuracy of the withdrawal address you provide. Crypto transactions cannot be reversed once broadcast.'),
('refunds','Refund Policy',4,'# Refund Policy

## 1. Unspent Wallet Funds
Unspent wallet funds may be withdrawn at any time. Approved refunds are processed immediately once verified, since all transactions are crypto based.

## 2. Cancelled or Voided Auctions
If RVBID cancels an auction, any locked funds are released back to your available balance immediately.

## 3. Vehicle Condition
Mechanical issues discovered after purchase and inspection are not refundable, as all RVs are sold as-is. Our team will still help assist with any issue that arises.

## 4. Disputes
Contact support@rvbid.com within 7 days of an auction closing if you believe a listing was materially misrepresented.'),
('auction-rules','Auction Rules',5,'# Auction Rules

1. Every auction runs on a 12-hour Fast Fingers countdown.
2. Bidding opens at $0 on every listing.
3. Only verified members with sufficient available wallet balance may bid.
4. Each bid must be higher than the current bid.
5. Placing a bid locks that amount until you are outbid or the auction ends.
6. The highest bid at the close of the countdown wins.
7. Bid history, including bidder IDs and amounts, is public on every listing.
8. Bidders may appear under an anonymous ID such as X6521.
9. The full VIN is visible to registered, verified members only.
10. All RVs are used and sold as-is. Our team will help assist with any issue that arises.'),
('identity','Identity Verification Policy',6,'# Identity Verification Policy

## Why We Verify
Verification keeps the auction fair, prevents fraudulent bidding and protects wallet balances.

## What We Require
A clear photo of a valid government-issued ID and a selfie taken by you.

## Review
Accounts stay Pending until our team completes review. Wallet, deposits, withdrawals and bidding unlock once your account is approved.

## Anonymity
Verification is between you and RVBID. You may still choose to remain anonymous to other bidders and appear only as a generated ID.

## Data Handling
Verification documents are stored privately, encrypted, and are never shown to other members.');
