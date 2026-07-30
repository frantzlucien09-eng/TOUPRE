/** Shared signed-URL helpers for private storage buckets. */

import { supabase } from './supabase';

const SIGNED_URL_TTL_SEC = 60 * 60; // 1 hour

export async function createSignedStorageUrl(
  bucket: string,
  path: string,
  expiresIn = SIGNED_URL_TTL_SEC
): Promise<string> {
  const clean = path.replace(/^\/+/, '');
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(clean, expiresIn);
  if (error || !data?.signedUrl) {
    throw error ?? new Error('Pa ka kreye lyen dokiman');
  }
  return data.signedUrl;
}

/** Extract storage object path from a full public/signed URL or return path as-is. */
export function storagePathFromUrl(urlOrPath: string, bucket: string): string {
  if (!urlOrPath.includes('://') && !urlOrPath.includes(`/${bucket}/`)) {
    return urlOrPath.replace(/^\/+/, '');
  }
  const marker = `/${bucket}/`;
  const idx = urlOrPath.indexOf(marker);
  if (idx >= 0) {
    return decodeURIComponent(urlOrPath.slice(idx + marker.length).split('?')[0]);
  }
  return urlOrPath;
}

export async function resolvePrivateStorageUrl(
  bucket: string,
  urlOrPath: string | null | undefined,
  expiresIn = SIGNED_URL_TTL_SEC
): Promise<string | null> {
  if (!urlOrPath) return null;
  const path = storagePathFromUrl(urlOrPath, bucket);
  return createSignedStorageUrl(bucket, path, expiresIn);
}
