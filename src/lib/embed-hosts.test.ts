import { describe, expect, it } from "vitest";
import {
  EMBED_ALLOWED_HOSTS,
  EMBED_FRAME_SRC,
  EMBED_HOSTS,
} from "./embed-hosts";
import { buildContentSecurityPolicy } from "./csp";

describe("embed-hosts", () => {
  it("derives the sanitiser's allow-list from EMBED_HOSTS", () => {
    expect([...EMBED_ALLOWED_HOSTS]).toEqual(EMBED_HOSTS);
  });

  it("derives the CSP frame-src origin list from EMBED_HOSTS", () => {
    expect(EMBED_FRAME_SRC).toBe(
      EMBED_HOSTS.map((host) => `https://${host}`).join(" "),
    );
  });

  it("threads every embed host into the site-wide CSP's frame-src", () => {
    const csp = buildContentSecurityPolicy("test-nonce");
    for (const host of EMBED_HOSTS) {
      expect(csp).toContain(`https://${host}`);
    }
  });
});
