import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

const { getSettings } = await import("./get-settings");

describe("getSettings", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("returns defaults merged with stored values", async () => {
    const builder = {
      select: vi.fn(() =>
        Promise.resolve({
          data: [{ key: "business_name", value: "Test Bakery" }],
          error: null,
        }),
      ),
    };
    fromMock.mockReturnValue(builder);

    const result = await getSettings();

    expect(result.businessName).toBe("Test Bakery");
    expect(result.maxOrdersPerDay).toBe(15);
  });

  // getSettings is wrapped in React's cache() so a request-scoped render
  // (root layout + a page both calling it) issues one Supabase query, not
  // two. That memoization is keyed off React's per-request render context,
  // which only exists inside an actual Next.js request — calling the
  // function directly in Vitest has no such context, so cache() is
  // effectively a no-op here and this isn't unit-testable. Verified instead
  // via the dev server's network log (see PR notes): a homepage load shows
  // exactly one /rest/v1/settings request, not two.
});
