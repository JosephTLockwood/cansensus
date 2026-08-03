"use client";

import { getSupabase } from "./supabase/client";

/** Longest edge of the stored image. Plenty for a can on a dark panel. */
const MAX_EDGE = 1200;
const QUALITY = 0.82;

/**
 * Shrinks and re-encodes a photo in the browser before upload.
 *
 * A phone camera produces 4-12 MB JPEGs and the bucket caps at 3 MB, so without
 * this most real uploads would simply be rejected. Re-encoding also strips EXIF
 * — which matters, because phone photos carry GPS coordinates and this is a
 * public bucket.
 */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that image.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob) throw new Error("Could not process that image.");
  return blob;
}

export type UploadResult = { path: string } | { error: string };

/**
 * Uploads a can photo and returns its storage path.
 *
 * The path is always `<uid>/…` because storage RLS only permits a user to write
 * inside a folder named after their own id — and the submissions route re-checks
 * that prefix rather than trusting whatever path the client sends.
 */
export async function uploadCanPhoto(file: File): Promise<UploadResult> {
  const supabase = getSupabase();
  if (!supabase) return { error: "Uploads are not configured." };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return { error: "Sign in to add a photo." };

  if (!file.type.startsWith("image/")) {
    return { error: "That is not an image." };
  }

  let body: Blob;
  try {
    body = await shrink(file);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not read that image." };
  }

  if (body.size > 3_000_000) {
    return { error: "Still too large after resizing — try a different photo." };
  }

  const path = `${uid}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("can-photos")
    .upload(path, body, { contentType: "image/jpeg", upsert: false });

  if (error) return { error: error.message };
  return { path };
}
