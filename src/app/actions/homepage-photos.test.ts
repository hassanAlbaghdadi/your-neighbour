import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/homepage/manage-homepage-photos", () => ({
  setHeroPhoto: vi.fn(async () => {}),
  clearHeroPhoto: vi.fn(async () => {}),
  addGalleryPhoto: vi.fn(async () => ({
    id: "photo-1",
    createdAt: "2026-08-12T00:00:00Z",
  })),
  updateGalleryPhoto: vi.fn(async () => {}),
  deleteGalleryPhoto: vi.fn(async () => {}),
  reorderGalleryPhotos: vi.fn(async () => {}),
  HomepagePhotoError: class HomepagePhotoError extends Error {},
}));

const {
  setHeroPhotoAction,
  clearHeroPhotoAction,
  addGalleryPhotoAction,
  updateGalleryPhotoAltAction,
  deleteGalleryPhotoAction,
  reorderGalleryPhotosAction,
} = await import("./homepage-photos");
const managePhotos = await import(
  "@/lib/services/homepage/manage-homepage-photos"
);
const { requireAdmin } = await import("@/lib/auth/require-admin");

describe("addGalleryPhotoAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the created photo under `data`, not the old `photo` field", async () => {
    const result = await addGalleryPhotoAction(
      "https://example.com/photo.jpg",
      null,
      0,
    );

    expect(result).toEqual({
      success: true,
      data: { id: "photo-1", createdAt: "2026-08-12T00:00:00Z" },
    });
    expect(result).not.toHaveProperty("photo");
  });

  it("returns the { success: false, error } shape on invalid input", async () => {
    const result = await addGalleryPhotoAction("not-a-url", null, 0);
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe("string");
  });
});

describe("setHeroPhotoAction", () => {
  it("returns the plain { success: true } shape (no data field)", async () => {
    const result = await setHeroPhotoAction(
      "https://example.com/hero.jpg",
      null,
    );
    expect(result).toEqual({ success: true });
  });
});

describe("authorization", () => {
  // See the note in products.test.ts -- same gate, same blind spot. All six
  // of these mutate what the storefront homepage shows.
  const actions: Array<[string, () => Promise<unknown>]> = [
    ["setHeroPhotoAction", () => setHeroPhotoAction("https://example.com/a.jpg", "Hero")],
    ["clearHeroPhotoAction", () => clearHeroPhotoAction()],
    ["addGalleryPhotoAction", () => addGalleryPhotoAction("https://example.com/a.jpg", "Alt", 0)],
    ["updateGalleryPhotoAltAction", () => updateGalleryPhotoAltAction("photo-1", "Alt")],
    ["deleteGalleryPhotoAction", () => deleteGalleryPhotoAction("photo-1")],
    ["reorderGalleryPhotosAction", () => reorderGalleryPhotosAction(["photo-1", "photo-2"])],
  ];

  for (const [name, invoke] of actions) {
    it(`${name} refuses a signed-out caller`, async () => {
      vi.clearAllMocks();
      vi.mocked(requireAdmin).mockResolvedValueOnce(null);

      await expect(invoke()).resolves.toEqual({
        success: false,
        error: "Unauthorized",
      });

      for (const exported of Object.values(managePhotos)) {
        if (vi.isMockFunction(exported)) expect(exported).not.toHaveBeenCalled();
      }
    });
  }
});
