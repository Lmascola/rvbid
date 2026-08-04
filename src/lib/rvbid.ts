import { supabase } from "@/integrations/supabase/client";

// Generated DB types are refreshed asynchronously; this loose client keeps
// queries typesafe-at-runtime without blocking on type regeneration.
/* eslint-disable @typescript-eslint/no-explicit-any */
export const db = supabase as any;

export const LISTING_COLUMNS =
  "id,title,year,make,model,vin_masked,mileage,sleeps,length_ft,rv_class,location,description,images,starting_bid,current_bid,bid_count,status,ends_at,sold_at,sold_price,winner_alias,queue_order,report_available,report_price,bid_visibility,created_at,updated_at";

export const PASSWORD_RULES = [
  { label: "At least 10 characters", test: (v: string) => v.length >= 10 },
  { label: "One uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { label: "One lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { label: "One number", test: (v: string) => /\d/.test(v) },
  { label: "One symbol", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export const passwordIsStrong = (value: string) => PASSWORD_RULES.every((r) => r.test(value));


export type Listing = {
  id: string;
  title: string;
  year: number | null;
  make: string | null;
  model: string | null;
  vin_masked: string | null;
  mileage: number | null;
  sleeps: number | null;
  length_ft: number | null;
  rv_class: string | null;
  location: string | null;
  description: string | null;
  images: string[];
  starting_bid: number;
  current_bid: number;
  bid_count: number;
  status: string;
  ends_at: string | null;
  sold_at: string | null;
  sold_price: number | null;
  winner_alias: string | null;
  queue_order: number;
  report_available: boolean;
  report_price: number;
  bid_visibility: string;
  created_at: string;
};

export type Bid = {
  id: string;
  listing_id: string;
  bidder_id: string | null;
  alias: string;
  amount: number;
  source: string;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  email: string;
  phone: string | null;
  state: string | null;
  zip: string | null;
  alias: string;
  is_anonymous: boolean;
  kyc_status: string;
  kyc_id_url: string | null;
  kyc_selfie_url: string | null;
  balance: number;
  locked: number;
};

export const money = (value: number | null | undefined) =>
  `$${Number(value ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export const num = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString("en-US");

export function timeLeft(endsAt: string | null) {
  if (!endsAt) return { ended: true, label: "Closed", urgent: false };
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return { ended: true, label: "Closing…", urgent: true };
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    ended: false,
    label: `${pad(h)}:${pad(m)}:${pad(s)}`,
    urgent: ms < 60 * 60 * 1000,
  };
}

export const listingImage = (listing: Pick<Listing, "images">) =>
  listing.images?.[0] ?? "/images/rv-1.jpg";

export async function closeExpiredAuctions() {
  try {
    await db.rpc("close_expired_auctions");
  } catch {
    /* non-blocking */
  }
}

/* ------------------------- date / time helpers ------------------------- */

/** ISO string -> value for an <input type="datetime-local"> in the viewer's own timezone. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value (local time) -> ISO string, or null when empty. */
export function fromLocalInput(value: string) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Timestamp rendered in the viewer's own timezone, with the zone abbreviation. */
export function dateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
