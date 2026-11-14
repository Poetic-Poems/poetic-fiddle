import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "./csp";

// src/proxy.test.ts covers the policy as the middleware actually emits it
// (nonce handling, the other directives, the header plumbing). These cover the
// one part of it that depends on which backend the app was built against: a
// Supabase instance off `supabase.co` is covered by neither `'self'` nor the
// `https://*.supabase.co` wildcard, so its origin has to be named.
function connectSrc(policy: string): string | undefined {
  return policy.match(/connect-src ([^;]+);/)?.[1];
}

describe("buildContentSecurityPolicy's connect-src", () => {
  it("names only 'self' and the wildcard for a hosted project", () => {
    expect(
      connectSrc(buildContentSecurityPolicy("n", "https://abc123.supabase.co")),
    ).toBe("'self' https://*.supabase.co");
  });

  it("is unchanged when no Supabase URL is configured", () => {
    expect(connectSrc(buildContentSecurityPolicy("n", undefined))).toBe(
      "'self' https://*.supabase.co",
    );
  });

  it("names a local instance's origin, which differs from the app's by port", () => {
    expect(
      connectSrc(buildContentSecurityPolicy("n", "http://127.0.0.1:54321")),
    ).toBe("'self' https://*.supabase.co http://127.0.0.1:54321");
  });

  it("names a self-hosted instance's origin, and only its origin", () => {
    expect(
      connectSrc(
        buildContentSecurityPolicy("n", "https://db.example.org/rest/v1"),
      ),
    ).toBe("'self' https://*.supabase.co https://db.example.org");
  });

  // A host that merely *contains* `supabase.co` is not a hosted project, so
  // the suffix test above must not mistake it for one and leave it out.
  it("names a host that only looks like a hosted project", () => {
    expect(
      connectSrc(
        buildContentSecurityPolicy("n", "https://supabase.co.evil.test"),
      ),
    ).toBe("'self' https://*.supabase.co https://supabase.co.evil.test");
  });

  it("falls back to the wildcard alone for an unparseable URL", () => {
    expect(connectSrc(buildContentSecurityPolicy("n", "not a url"))).toBe(
      "'self' https://*.supabase.co",
    );
  });
});
