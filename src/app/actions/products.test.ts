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

const {
  createProductAction,
  updateProductAction,
  deleteProductAction,
  setProductAvailabilityAction,
  setVariantAvailabilityAction,
} = await import("./products");
const manageProducts = await import("@/lib/services/products/manage-products");
const { requireAdmin } = await import("@/lib/auth/require-admin");

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

describe("authorization", () => {
  // Every action in this file opens with `if (!(await requireAdmin()))`, and
  // every other test here mocks requireAdmin to hand back an admin -- so
  // deleting that line from any of them left the whole suite green. These
  // pin the signed-out path: refuse, and never reach the service layer.
  const actions: Array<[string, () => Promise<unknown>]> = [
    ["createProductAction", () => createProductAction(validPayload)],
    ["updateProductAction", () => updateProductAction("product-1", validPayload)],
    ["deleteProductAction", () => deleteProductAction("product-1")],
    ["setProductAvailabilityAction", () => setProductAvailabilityAction("product-1", false)],
    ["setVariantAvailabilityAction", () => setVariantAvailabilityAction("variant-1", false)],
  ];

  for (const [name, invoke] of actions) {
    it(`${name} refuses a signed-out caller`, async () => {
      vi.clearAllMocks();
      vi.mocked(requireAdmin).mockResolvedValueOnce(null);

      await expect(invoke()).resolves.toEqual({
        success: false,
        error: "Unauthorized",
      });

      for (const exported of Object.values(manageProducts)) {
        if (vi.isMockFunction(exported)) expect(exported).not.toHaveBeenCalled();
      }
    });
  }
});
