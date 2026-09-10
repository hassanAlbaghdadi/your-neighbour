import { describe, it, expect } from "vitest";
import supabaseImageLoader from "./supabase-image-loader";

const OBJECT_URL =
  "https://brzvwghjrfugovyheurq.supabase.co/storage/v1/object/public/product-images/8a7f085f.jpg";

describe("supabaseImageLoader", () => {
  it("rewrites a Supabase public-object URL to the render endpoint with width and quality", () => {
    const out = new URL(
      supabaseImageLoader({ src: OBJECT_URL, width: 640, quality: 60 }),
    );
    expect(out.pathname).toBe(
      "/storage/v1/render/image/public/product-images/8a7f085f.jpg",
    );
    expect(out.searchParams.get("width")).toBe("640");
    expect(out.searchParams.get("quality")).toBe("60");
    // Load-bearing: without it Supabase distorts a width-only request.
    expect(out.searchParams.get("resize")).toBe("contain");
  });

  it("defaults quality to 75 when the caller omits it", () => {
    const out = new URL(supabaseImageLoader({ src: OBJECT_URL, width: 828 }));
    expect(out.searchParams.get("quality")).toBe("75");
  });

  it("passes relative paths through untouched", () => {
    expect(
      supabaseImageLoader({ src: "/brand/mark-black.png", width: 32 }),
    ).toBe("/brand/mark-black.png");
  });

  it("passes non-Supabase absolute URLs through untouched", () => {
    const src = "https://example.com/photo.jpg";
    expect(supabaseImageLoader({ src, width: 640 })).toBe(src);
  });

  it("does not re-rewrite a URL that is already on the render endpoint", () => {
    const rendered =
      "https://brzvwghjrfugovyheurq.supabase.co/storage/v1/render/image/public/product-images/8a7f085f.jpg?width=640&quality=75";
    expect(supabaseImageLoader({ src: rendered, width: 1080 })).toBe(rendered);
  });
});
