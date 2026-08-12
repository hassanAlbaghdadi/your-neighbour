import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/settings/update-settings", () => ({
  updateSettings: vi.fn(async () => {}),
}));

const { updateSettingsAction } = await import("./settings");

const validPayload = {
  businessName: "Your Neighbour",
  contactEmail: "sarah@example.com",
  maxOrdersPerDay: 15,
  minAdvanceHours: 24,
  pickupTimeSlots: ["09:00"],
  blackoutDates: [],
};

describe("updateSettingsAction", () => {
  beforeEach(() => {
    getUserMock.mockReset();
  });

  it("returns the { success: true } shape when authorized with valid input", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "admin-1" } } });

    const result = await updateSettingsAction(validPayload);

    expect(result).toEqual({ success: true });
  });

  it("returns the { success: false, error: 'Unauthorized' } shape when logged out", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const result = await updateSettingsAction(validPayload);

    expect(result).toEqual({ success: false, error: "Unauthorized" });
  });
});
