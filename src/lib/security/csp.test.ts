import { describe, it, expect } from "vitest";
import { buildContentSecurityPolicy } from "./csp";

const NONCE = "test-nonce-123";
const SUPABASE_URL = "https://abcdefgh.supabase.co";

function prod(supabaseUrl: string | undefined = SUPABASE_URL) {
  return buildContentSecurityPolicy(NONCE, { isDev: false, supabaseUrl });
}

function directive(policy: string, name: string): string {
  const found = policy
    .split("; ")
    .find((part) => part === name || part.startsWith(`${name} `));
  return found ?? "";
}

describe("buildContentSecurityPolicy", () => {
  it("locks scripts to the request's nonce", () => {
    const scriptSrc = directive(prod(), "script-src");

    expect(scriptSrc).toContain(`'nonce-${NONCE}'`);
    expect(scriptSrc).toContain("'strict-dynamic'");
  });

  it("never allows unsafe-inline or unsafe-eval scripts in production", () => {
    // The entire value of the nonce is that an injected <script> can't
    // guess it. Either of these hands that back.
    const scriptSrc = directive(prod(), "script-src");

    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
  });

  it("allows the eval and websocket that only the dev server needs", () => {
    const dev = buildContentSecurityPolicy(NONCE, {
      isDev: true,
      supabaseUrl: SUPABASE_URL,
    });

    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "connect-src")).toContain("ws:");
  });

  it("lets the browser reach Supabase for data, auth and photos", () => {
    const policy = prod();

    expect(directive(policy, "connect-src")).toContain(SUPABASE_URL);
    expect(directive(policy, "img-src")).toContain(SUPABASE_URL);
  });

  it("allows inline style attributes, which components rely on", () => {
    // product-card's variant indicator positions itself with a `style`
    // attribute; those fall under style-src when style-src-attr is absent,
    // so a nonce-only style policy would silently break it.
    expect(directive(prod(), "style-src")).toContain("'unsafe-inline'");
  });

  it("forbids framing, plugins and off-origin form posts", () => {
    const policy = prod();

    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("form-action 'self'");
  });

  it("upgrades insecure requests in production but not in dev", () => {
    expect(prod()).toContain("upgrade-insecure-requests");

    const dev = buildContentSecurityPolicy(NONCE, {
      isDev: true,
      supabaseUrl: SUPABASE_URL,
    });
    expect(dev).not.toContain("upgrade-insecure-requests");
  });

  it("still emits a usable policy when the Supabase url is missing or malformed", () => {
    // A bad env var shouldn't produce a header that takes the site down.
    for (const url of [undefined, "not-a-url"] as const) {
      const policy = buildContentSecurityPolicy(NONCE, {
        isDev: false,
        supabaseUrl: url,
      });
      expect(directive(policy, "connect-src")).toBe("connect-src 'self'");
      expect(directive(policy, "default-src")).toBe("default-src 'self'");
    }
  });
});
