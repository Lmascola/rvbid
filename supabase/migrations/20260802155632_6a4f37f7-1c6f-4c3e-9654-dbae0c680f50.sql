
create policy "kyc own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "kyc own read" on storage.objects for select to authenticated
  using (bucket_id = 'kyc-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(),'admin')));
create policy "kyc own update" on storage.objects for update to authenticated
  using (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "rv photos read" on storage.objects for select to authenticated
  using (bucket_id = 'rv-photos');
create policy "rv photos admin write" on storage.objects for insert to authenticated
  with check (bucket_id = 'rv-photos' and public.has_role(auth.uid(),'admin'));
create policy "rv photos admin update" on storage.objects for update to authenticated
  using (bucket_id = 'rv-photos' and public.has_role(auth.uid(),'admin'));
create policy "rv photos admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'rv-photos' and public.has_role(auth.uid(),'admin'));
