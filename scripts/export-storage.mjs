#!/usr/bin/env node
/**
 * Download EVERY file from the current (Lovable-managed) Supabase Storage buckets
 * to a local folder you own. No service-role key needed: it signs in as your
 * admin account and uses the same permissions the app itself uses.
 *
 * Usage:
 *   OLD_SUPABASE_URL=https://<old-ref>.supabase.co \
 *   OLD_SUPABASE_PUBLISHABLE_KEY=<old anon/publishable key> \
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' \
 *   node scripts/export-storage.mjs ./storage-backup
 */
import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const url = process.env.OLD_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key =
  process.env.OLD_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const outRoot = process.argv[2] || './storage-backup';
const BUCKETS = ['rv-photos', 'kyc-documents'];

if (!url || !key) throw new Error('Set OLD_SUPABASE_URL and OLD_SUPABASE_PUBLISHABLE_KEY');
if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (your admin account)');

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set('apikey', key);
      if (headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
      return fetch(input, { ...init, headers });
    },
  },
});

const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError) throw new Error(`Sign-in failed: ${authError.message}`);

async function walk(bucket, prefix = '') {
  const files = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
  for (const entry of data ?? []) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) files.push(...(await walk(bucket, path)));
    else files.push(path);
  }
  return files;
}

let total = 0;
for (const bucket of BUCKETS) {
  const paths = await walk(bucket);
  console.log(`${bucket}: ${paths.length} files`);
  for (const path of paths) {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error) {
      console.error(`  FAILED ${path}: ${error.message}`);
      continue;
    }
    const target = join(outRoot, bucket, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await data.arrayBuffer()));
    total++;
    console.log(`  saved ${bucket}/${path}`);
  }
}
console.log(`\nDone. ${total} files written under ${outRoot}`);
