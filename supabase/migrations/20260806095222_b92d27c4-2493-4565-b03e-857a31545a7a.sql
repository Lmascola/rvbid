ALTER TABLE public.deposit_addresses
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS deposit_addresses_user_idx
  ON public.deposit_addresses (user_id, currency, active);

DROP POLICY IF EXISTS "members read addresses" ON public.deposit_addresses;
CREATE POLICY "members read addresses" ON public.deposit_addresses
  FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.create_deposit_intent(_amount numeric, _currency text)
 RETURNS deposit_intents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid := auth.uid(); v_profile public.profiles%rowtype;
        v_addr public.deposit_addresses%rowtype; v_row public.deposit_intents;
begin
  if v_uid is null then raise exception 'Sign in first.'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.kyc_status <> 'approved' then
    raise exception 'Your account must be verified and approved before you can fund your wallet.';
  end if;
  if coalesce(_amount,0) <= 0 then raise exception 'Enter the amount you want to deposit.'; end if;

  -- A member-specific address wins over the shared default for the same asset.
  select * into v_addr from public.deposit_addresses
    where active and currency = _currency and user_id = v_uid
    order by created_at desc limit 1;

  if v_addr.id is null then
    select * into v_addr from public.deposit_addresses
      where active and currency = _currency and user_id is null
      order by created_at limit 1;
  end if;

  if v_addr.id is null then
    raise exception 'No deposit address is configured for % yet. Our team is on it.', _currency;
  end if;

  update public.deposit_intents set status = 'expired'
    where user_id = v_uid and status = 'awaiting';
  insert into public.deposit_intents (user_id, amount, currency, network, address, qr_url)
  values (v_uid, _amount, _currency, v_addr.network, v_addr.address, coalesce(v_addr.qr_url,''))
  returning * into v_row;
  return v_row;
end; $function$;