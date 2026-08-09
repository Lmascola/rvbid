CREATE OR REPLACE FUNCTION public.purchase_vehicle_report(_listing_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid := auth.uid(); v_p public.profiles%rowtype; v_l public.listings%rowtype;
begin
  if v_uid is null then raise exception 'Sign in first.'; end if;
  select * into v_p from public.profiles where id = v_uid for update;
  if v_p.kyc_status <> 'approved' then raise exception 'Your account is pending verification.'; end if;
  select * into v_l from public.listings where id = _listing_id;
  if v_l.id is null or not v_l.report_available then raise exception 'No report is available for this RV.'; end if;
  if v_l.status <> 'live' then
    raise exception 'This auction has closed. Vehicle history reports are only available for live auctions.';
  end if;
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
end; $function$