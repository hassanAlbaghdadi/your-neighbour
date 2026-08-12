import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProductInput } from "./manage-products";

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: fromMock,
    rpc: rpcMock,
  }),
}));

const { updateProduct, ProductError } = await import("./manage-products");

const EXISTING_VARIANT_ID = "33333333-3333-4333-8333-333333333333";

const baseInput: ProductInput = {
  name: "Sourdough Loaf",
  slug: "sourdough-loaf",
  categoryId: null,
  imageUrl: null,
  description: null,
  isAvailable: true,
  preparationNotice: null,
  allergens: null,
  displayOrder: 0,
  variants: [
    {
      id: EXISTING_VARIANT_ID,
      label: "Large",
      price: 9,
      imageUrl: null,
      isAvailable: true,
      displayOrder: 0,
    },
  ],
};

function queryBuilder(result: Record<string, unknown>) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    then: (
      resolve: (value: unknown) => void,
      reject: (reason: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function setupSupabaseMocks({
  existingVariants = [{ id: EXISTING_VARIANT_ID }],
  rpcError = null,
}: {
  existingVariants?: Array<{ id: string }>;
  rpcError?: { code?: string; message: string } | null;
} = {}) {
  fromMock.mockImplementation((table: string) => {
    if (table === "product_variants") {
      return queryBuilder({ data: existingVariants, error: null });
    }
    throw new Error(`Unexpected table in test: ${table}`);
  });
  rpcMock.mockResolvedValue({ error: rpcError });
}

describe("updateProduct", () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it("updates the product and its variants via a single atomic RPC call", async () => {
    setupSupabaseMocks();

    await updateProduct("product-1", baseInput);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith(
      "update_product_atomic",
      expect.objectContaining({
        p_product_id: "product-1",
        p_product_row: expect.objectContaining({ slug: "sourdough-loaf" }),
        p_variants_to_update: expect.arrayContaining([
          expect.objectContaining({ id: EXISTING_VARIANT_ID, price: 9 }),
        ]),
        p_variants_to_insert: [],
        p_variant_ids_to_delete: [],
      }),
    );
  });

  it("maps a 23505 RPC error to the duplicate-slug ProductError", async () => {
    setupSupabaseMocks({
      rpcError: { code: "23505", message: "duplicate key" },
    });

    await expect(updateProduct("product-1", baseInput)).rejects.toThrow(
      ProductError,
    );
    await expect(updateProduct("product-1", baseInput)).rejects.toThrow(
      "A product with this slug already exists.",
    );
  });

  it("maps a 23503 RPC error to the referenced-variant ProductError", async () => {
    setupSupabaseMocks({
      rpcError: { code: "23503", message: "foreign key violation" },
    });

    await expect(updateProduct("product-1", baseInput)).rejects.toThrow(
      ProductError,
    );
    await expect(updateProduct("product-1", baseInput)).rejects.toThrow(
      "can't be deleted",
    );
  });

  it("sends removed variant ids to the RPC instead of deleting them itself", async () => {
    setupSupabaseMocks({
      existingVariants: [
        { id: EXISTING_VARIANT_ID },
        { id: "44444444-4444-4444-8444-444444444444" },
      ],
    });

    await updateProduct("product-1", baseInput);

    expect(rpcMock).toHaveBeenCalledWith(
      "update_product_atomic",
      expect.objectContaining({
        p_variant_ids_to_delete: ["44444444-4444-4444-8444-444444444444"],
      }),
    );
    // No direct product_variants delete/update calls — the RPC does it all.
    expect(fromMock).not.toHaveBeenCalledWith("products");
  });
});
