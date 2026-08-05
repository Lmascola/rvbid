CREATE OR REPLACE FUNCTION public.notify_outbid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_prev record;
  v_top numeric;
  v_title text;
begin
  -- Only a bid that actually takes the lead can outbid anyone.
  select max(b.amount) into v_top
    from public.bids b
    where b.listing_id = new.listing_id and b.id <> new.id;

  if v_top is null or new.amount <= v_top then
    return new;
  end if;

  -- The single member who held the top bid immediately before this one.
  select b.bidder_id, b.amount into v_prev
    from public.bids b
    where b.listing_id = new.listing_id
      and b.id <> new.id
      and b.bidder_id is not null
      and b.amount = v_top
    order by b.created_at desc
    limit 1;

  if v_prev.bidder_id is null or v_prev.bidder_id = new.bidder_id then
    return new;
  end if;

  select 'You were outbid on ' || l.title into v_title
    from public.listings l where l.id = new.listing_id;

  -- Replace any still-unread outbid alert for this member on this auction so
  -- repeated bidding cannot stack multiple notifications.
  delete from public.notifications
   where user_id = v_prev.bidder_id
     and listing_id = new.listing_id
     and kind = 'outbid'
     and read_at is null;

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

  return new;
end; $function$;