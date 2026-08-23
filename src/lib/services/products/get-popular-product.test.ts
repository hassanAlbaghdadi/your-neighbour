import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.fn();

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

const { getMostPopularProductId } = await import("./get-popular-product");

/**
 * The query is `.select().eq().gte()` and is awaited at the end, so the stub
 * has to be thenable rather than a plain chain of mockReturnThis().
 */
function queueRows(rows: unknown[], error: unknown = null) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    then: (
      resolve: (v: { data: unknown; error: unknown }) => unknown,
      reject?: (r: unknown) => unknown,
    ) => Promise.resolve({ data: rows, error }).then(resolve, reject),
  };
  fromMock.mockReturnValue(builder);
}

/** One order_items row; the embedded order is filtered server-side. */
function item(productId: string, orderId: string) {
  return { product_id: productId, order_id: orderId, orders: {} };
}

describe("getMostPopularProductId", () => {
  beforeEach(() => {
    fromMock.mockReset();
    // cache() memoises per request; vitest gives each test a fresh module
    // registry per file, but the same call within a file would be reused —
    // every case below therefore uses distinct data through a fresh queue.
    vi.resetModules();
  });

  it("returns the product appearing in the most distinct orders", async () => {
    queueRows([
      item("mix", "o1"),
      item("mix", "o2"),
      item("mix", "o3"),
      item("mix", "o4"),
      item("mix", "o5"),
      item("classic", "o1"),
      item("classic", "o2"),
    ]);

    const { getMostPopularProductId: fn } = await import("./get-popular-product");
    expect(await fn()).toBe("mix");
  });

  it("counts a product once per order, however many lines it fills", async () => {
    // Units would hand the badge to whatever comes in the biggest pack; one
    // customer buying three sizes of the same thing is still one customer.
    queueRows([
      item("classic", "o1"),
      item("classic", "o1"),
      item("classic", "o1"),
      item("mix", "o1"),
      item("mix", "o2"),
      item("mix", "o3"),
      item("mix", "o4"),
      item("mix", "o5"),
    ]);

    const { getMostPopularProductId: fn } = await import("./get-popular-product");
    expect(await fn()).toBe("mix");
  });

  it("claims nothing below the minimum order count", async () => {
    // The honesty floor. With four orders on the books the first thing
    // anyone bought would otherwise wear a badge summarising what customers
    // choose — inventing the claim rather than reporting it.
    queueRows([
      item("mix", "o1"),
      item("mix", "o2"),
      item("mix", "o3"),
      item("mix", "o4"),
    ]);

    const { getMostPopularProductId: fn } = await import("./get-popular-product");
    expect(await fn()).toBeNull();
  });

  it("claims nothing on a tie", async () => {
    // Two products can't both be the most popular one, and breaking the tie
    // arbitrarily would put an unsupported claim on the page.
    queueRows([
      item("mix", "o1"),
      item("mix", "o2"),
      item("mix", "o3"),
      item("mix", "o4"),
      item("mix", "o5"),
      item("classic", "o1"),
      item("classic", "o2"),
      item("classic", "o3"),
      item("classic", "o4"),
      item("classic", "o5"),
    ]);

    const { getMostPopularProductId: fn } = await import("./get-popular-product");
    expect(await fn()).toBeNull();
  });

  it("claims nothing when there are no orders at all", async () => {
    queueRows([]);

    const { getMostPopularProductId: fn } = await import("./get-popular-product");
    expect(await fn()).toBeNull();
  });

  it("throws when the query fails rather than silently claiming nothing", async () => {
    queueRows([], { message: "db down" });

    const { getMostPopularProductId: fn } = await import("./get-popular-product");
    await expect(fn()).rejects.toThrow("db down");
  });
});
