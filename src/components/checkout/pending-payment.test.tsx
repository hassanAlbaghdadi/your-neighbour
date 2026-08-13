import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { PendingPayment } from "./pending-payment";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

// Mirrors the constants in pending-payment.tsx.
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 15;

/**
 * Runs `count` poll cycles.
 *
 * Stepped one interval at a time rather than advanced in a single jump:
 * each pass only schedules the next timeout after its state update has
 * re-rendered, so a single large advance fires the first timer and then
 * finds nothing else pending.
 */
async function advancePolls(count: number) {
  for (let i = 0; i < count; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });
  }
}

describe("PendingPayment", () => {
  beforeEach(() => {
    refreshMock.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls the server so the customer doesn't have to refresh by hand", async () => {
    // Stripe's redirect to success_url routinely lands before the webhook
    // that flips payment_status, so this screen is what a *successful*
    // payment looks like for the first second or two.
    render(<PendingPayment />);

    expect(refreshMock).not.toHaveBeenCalled();

    await advancePolls(1);
    expect(refreshMock).toHaveBeenCalledTimes(1);

    await advancePolls(1);
    expect(refreshMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after a bounded number of attempts instead of polling forever", async () => {
    render(<PendingPayment />);

    await advancePolls(MAX_POLLS + 5);

    expect(refreshMock).toHaveBeenCalledTimes(MAX_POLLS);
    expect(
      screen.getByText(/still confirming your payment/i),
    ).toBeInTheDocument();
  });

  it("reassures the customer their money is accounted for once it gives up", async () => {
    render(<PendingPayment />);

    await advancePolls(MAX_POLLS);

    // The one thing a customer staring at this screen needs to know is
    // that a charge that went through isn't lost.
    expect(screen.getByText(/if you were charged/i)).toBeInTheDocument();
  });

  it("restarts polling when the customer asks it to check again", async () => {
    render(<PendingPayment />);
    await advancePolls(MAX_POLLS);
    expect(refreshMock).toHaveBeenCalledTimes(MAX_POLLS);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /check again/i }));
    });

    expect(refreshMock).toHaveBeenCalledTimes(MAX_POLLS + 1);
    expect(screen.getByText(/confirming payment/i)).toBeInTheDocument();

    await advancePolls(1);
    expect(refreshMock).toHaveBeenCalledTimes(MAX_POLLS + 2);
  });

  it("announces status changes to screen readers", async () => {
    render(<PendingPayment />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });
});
