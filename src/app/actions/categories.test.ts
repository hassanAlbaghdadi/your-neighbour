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

const { createCategoryAction } = await import("./categories");

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
