import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/products/manage-products", () => ({
  createProduct: vi.fn(async () => {}),
  updateProduct: vi.fn(async () => {}),
  deleteProduct: vi.fn(async () => {}),
  setProductAvailability: vi.fn(async () => {}),
  setVariantAvailability: vi.fn(async () => {}),
  ProductError: class ProductError extends Error {},
}));

const { createProductAction } = await import("./products");

const validPayload = {
  name: "Sourdough Loaf",
  slug: "sourdough-loaf",
  categoryId: null,
  imageUrl: null,
  description: "",
  isAvailable: true,
  preparationNotice: "",
  allergens: "",
  displayOrder: 0,
  variants: [
    {
      label: "Large",
      price: 8,
      imageUrl: null,
      isAvailable: true,
      displayOrder: 0,
    },
  ],
};

describe("createProductAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the { success: true } shape on valid input", async () => {
    const result = await createProductAction(validPayload);
    expect(result).toEqual({ success: true });
  });

  it("returns the { success: false, error } shape on invalid input", async () => {
    const result = await createProductAction({ ...validPayload, name: "" });
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe("string");
  });
});
