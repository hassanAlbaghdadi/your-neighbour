import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.fn();

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

const { getOrderById } = await import("./get-order");

describe("getOrderById", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("returns null for a malformed id without querying the database", async () => {
    const result = await getOrderById("not-a-uuid");

    expect(result).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns null for an empty string id without querying the database", async () => {
    const result = await getOrderById("");

    expect(result).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("queries the database for a well-formed uuid", async () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    };
    fromMock.mockReturnValue(builder);

    const result = await getOrderById(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(result).toBeNull();
    expect(fromMock).toHaveBeenCalledWith("orders");
  });
});
