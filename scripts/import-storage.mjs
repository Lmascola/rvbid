#!/usr/bin/env node
/**
 * Upload the folder produced by scripts/export-storage.mjs into the Storage
 * buckets of the Supabase project YOU own. Paths (and therefore every
 * listings.images reference and KYC URL) are preserved exactly.
 *
 * Create the private buckets `rv-photos` and `kyc-documents` first.
 *
 * Usage:
 *   NEW_SUPABASE_URL=https://<your-ref>.supabase.co \
 *   NEW_SUPABASE_SERVICE_ROLE_KEY=<your service role key> \
 *   node scripts/import-storage.mjs ./storage-backup
 */
import { createClient } from '@supabase/supabase-js';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const url = process.env.NEW_SUPABASE_URL;
const key = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY;
const inRoot = process.argv[2] || './storage-backup';
const BUCKETS = ['rv-photos', 'kyc-documents'];

if (!url || !key) throw new Error('Set NEW_SUPABASE_URL and NEW_SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', avif: 'image/avif', pdf: 'application/pdf', heic: 'image/heic',
};

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

let total = 0;
for (const bucket of BUCKETS) {
  const root = join(inRoot, bucket);
  const files = await walk(root);
  console.log(`${bucket}: ${files.length} files`);
  for (const file of files) {
    const path = relative(root, file).split(sep).join('/');
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, await readFile(file), {
        upsert: true,
        contentType: TYPES[ext] ?? 'application/octet-stream',
      });
    if (error) {
      console.error(`  FAILED ${path}: ${error.message}`);
      continue;
    }
    total++;
    console.log(`  uploaded ${bucket}/${path}`);
  }
}
console.log(`\nDone. ${total} files uploaded to ${url}`);
