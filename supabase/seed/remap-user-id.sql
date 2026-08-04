-- OPTIONAL: only needed if you rebuild the schema with `supabase db push` and
-- load PUBLIC data only (no auth.users), then re-register your account on the
-- new project. It repoints every row that referenced your old account id at
-- your new one, so bids, wallet, KYC and the admin role stay intact.
--
-- Old account id in the current Lovable-managed project: 5a0c5281-1649-49f8-96ad-5c09facc0fbe
-- Replace :old_id / :new_id below, then run in the SQL editor of YOUR project.

BEGIN;

-- new id = the id of the freshly registered account (select id from auth.users)
CREATE TEMP TABLE _remap(old_id uuid, new_id uuid);
INSERT INTO _remap VALUES
  ('5a0c5281-1649-49f8-96ad-5c09facc0fbe', '<PASTE-NEW-USER-ID-HERE>');

UPDATE public.profiles p        SET id      = r.new_id FROM _remap r WHERE p.id = r.old_id;
UPDATE public.user_roles t      SET user_id = r.new_id FROM _remap r WHERE t.user_id = r.old_id;
UPDATE public.bids t            SET bidder_id = r.new_id FROM _remap r WHERE t.bidder_id = r.old_id;
UPDATE public.deposits t        SET user_id = r.new_id FROM _remap r WHERE t.user_id = r.old_id;
UPDATE public.deposit_intents t SET user_id = r.new_id FROM _remap r WHERE t.user_id = r.old_id;
UPDATE public.withdrawals t     SET user_id = r.new_id FROM _remap r WHERE t.user_id = r.old_id;
UPDATE public.transactions t    SET user_id = r.new_id FROM _remap r WHERE t.user_id = r.old_id;
UPDATE public.report_orders t   SET user_id = r.new_id FROM _remap r WHERE t.user_id = r.old_id;
UPDATE public.notifications t   SET user_id = r.new_id FROM _remap r WHERE t.user_id = r.old_id;
UPDATE public.listings t        SET winner_id = r.new_id FROM _remap r WHERE t.winner_id = r.old_id;

-- storage paths are keyed by user id for KYC uploads
UPDATE public.profiles
   SET kyc_id_url     = replace(kyc_id_url,     (SELECT old_id::text FROM _remap), (SELECT new_id::text FROM _remap)),
       kyc_selfie_url = replace(kyc_selfie_url, (SELECT old_id::text FROM _remap), (SELECT new_id::text FROM _remap))
 WHERE kyc_id_url IS NOT NULL OR kyc_selfie_url IS NOT NULL;

-- make sure the admin role exists on the new account
INSERT INTO public.user_roles(user_id, role)
SELECT new_id, 'admin' FROM _remap
ON CONFLICT (user_id, role) DO NOTHING;

-- refresh derived listing figures
SELECT public.recompute_listing_bids(id) FROM public.listings;

COMMIT;
