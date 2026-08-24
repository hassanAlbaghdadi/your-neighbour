import { z } from "zod";

const STORAGE_KEY = "your-neighbour-customer";

/**
 * The contact details a returning customer would otherwise retype.
 *
 * Deliberately only the three fields that never change between orders.
 * Notes are per-order and are never kept; nothing here is sensitive enough
 * to warrant more than localStorage, and it is the same store the cart
 * already uses. This matters more than it looks: the bakery runs on repeat
 * orders placed on phones, and browser autofill is unreliable inside the
 * in-app browsers that Instagram traffic arrives in.
 */
const rememberedCustomerSchema = z.object({
  customerName: z.string().max(100),
  customerEmail: z.string().max(200),
  customerPhone: z.string().max(20),
});

export type RememberedCustomer = z.infer<typeof rememberedCustomerSchema>;

export function readRememberedCustomer(): RememberedCustomer | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    // Validated rather than cast, for the same reason the cart is: a shape
    // written by an older build should be treated as absent, not spread
    // into the form as undefined values.
    const parsed = rememberedCustomerSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function rememberCustomer(customer: RememberedCustomer) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customer));
  } catch {
    // Private browsing, or a full quota. Not remembering someone is a
    // missing convenience, never a reason to fail their order.
  }
}

export function forgetCustomer() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // As above.
  }
}
