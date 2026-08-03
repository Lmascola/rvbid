CREATE OR REPLACE FUNCTION public.admin_claim_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'admin_exists', EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'),
    'eligible', (
      auth.uid() IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
    ),
    'eligible_email', NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.claim_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('rvbid_admin_claim'));

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'An administrator already exists for this platform.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.listing_bids(_listing_id uuid)
RETURNS TABLE(id uuid, alias text, amount numeric, source text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.alias, b.amount, b.source, b.created_at
  FROM public.bids b
  WHERE b.listing_id = _listing_id
  ORDER BY b.created_at ASC, b.amount ASC, b.id ASC;
$$;

REVOKE ALL ON FUNCTION public.admin_claim_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_claim_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.listing_bids(uuid) TO anon, authenticated;