"use client";

/**
 * Custom `next/image` loader — wired up via `images.loaderFile` in
 * next.config.ts, so it runs for every `<Image>` in the app.
 *
 * Why this exists: the built-in Vercel Image Optimization API meters every
 * unique (source, width, quality, format) variant against a small free-tier
 * quota, and once that quota is spent Vercel serves `/_next/image` a bare
 * `402` and every photo on the storefront breaks. Our photos already live
 * in Supabase Storage, which has its own on-the-fly transformer, so we send
 * the resize work there instead and take Vercel's optimizer out of the path
 * entirely.
 *
 * Supabase's transform endpoint mirrors the public-object URL, swapping
 *   /storage/v1/object/public/<bucket>/<path>
 * for
 *   /storage/v1/render/image/public/<bucket>/<path>?width=&quality=&resize=contain
 * and negotiates WebP vs. the original format from the request's `Accept`
 * header, the same way Vercel's optimizer did.
 *
 * `resize=contain` is load-bearing: a `next/image` loader is only ever
 * handed a width, and Supabase's default `resize=cover` needs BOTH
 * dimensions — given width alone it squashes the width and leaves the
 * original height untouched, so the photo arrives vertically stretched and
 * `object-cover` then crops it to a zoomed-in sliver. `contain` with a lone
 * width scales proportionally, which is exactly what the component expects.
 *
 * Anything that isn't a Supabase public-object URL — the local /brand/*
 * marks, say — is returned untouched, so `next/image` emits it as a plain
 * `<img src>` with no optimization, which is correct for a small static PNG.
 */

const OBJECT_PREFIX = "/storage/v1/object/public/";
const RENDER_PREFIX = "/storage/v1/render/image/public/";

interface LoaderArgs {
  src: string;
  width: number;
  quality?: number;
}

export default function supabaseImageLoader({
  src,
  width,
  quality,
}: LoaderArgs): string {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    // Relative path (e.g. "/brand/mark-black.png") — nothing to transform.
    return src;
  }

  if (!url.pathname.startsWith(OBJECT_PREFIX)) {
    // Some other absolute URL, or an already-transformed one. Leave it be.
    return src;
  }

  url.pathname = RENDER_PREFIX + url.pathname.slice(OBJECT_PREFIX.length);
  url.searchParams.set("width", String(width));
  url.searchParams.set("quality", String(quality ?? 75));
  url.searchParams.set("resize", "contain");
  return url.toString();
}
