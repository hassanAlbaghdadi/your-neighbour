import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/categories/manage-categories", () => ({
  createCategory: vi.fn(async () => {}),
  updateCategory: vi.fn(async () => {}),
  deleteCategory: vi.fn(async () => {}),
  CategoryError: class CategoryError extends Error {},
}));

const {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} = await import("./categories");
const manageCategories = await import("@/lib/services/categories/manage-categories");
const { requireAdmin } = await import("@/lib/auth/require-admin");

describe("createCategoryAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the { success: true } shape on valid input", async () => {
    const result = await createCategoryAction({
      name: "Baked Treats",
      slug: "baked-treats",
      displayOrder: 0,
    });
    expect(result).toEqual({ success: true });
  });

  it("returns the { success: false, error } shape on invalid input", async () => {
    const result = await createCategoryAction({
      name: "",
      slug: "baked-treats",
      displayOrder: 0,
    });
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe("string");
  });
});

describe("authorization", () => {
  // See the note in products.test.ts -- same gate, same blind spot.
  const actions: Array<[string, () => Promise<unknown>]> = [
    ["createCategoryAction", () => createCategoryAction({ name: "Breads", displayOrder: 0 })],
    ["updateCategoryAction", () => updateCategoryAction("category-1", { name: "Breads", displayOrder: 0 })],
    ["deleteCategoryAction", () => deleteCategoryAction("category-1")],
  ];

  for (const [name, invoke] of actions) {
    it(`${name} refuses a signed-out caller`, async () => {
      vi.clearAllMocks();
      vi.mocked(requireAdmin).mockResolvedValueOnce(null);

      await expect(invoke()).resolves.toEqual({
        success: false,
        error: "Unauthorized",
      });

      for (const exported of Object.values(manageCategories)) {
        if (vi.isMockFunction(exported)) expect(exported).not.toHaveBeenCalled();
      }
    });
  }
});
