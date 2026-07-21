import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

async function getCspHeader() {
  const groups = await nextConfig.headers!();
  const group = groups.find((g) =>
    g.headers.some((h) => h.key === "Content-Security-Policy"),
  );
  const header = group?.headers.find(
    (h) => h.key === "Content-Security-Policy",
  );
  if (!header) throw new Error("No Content-Security-Policy header found");
  return { source: group!.source, value: header.value };
}

describe("Content-Security-Policy header", () => {
  it("applies to every route", async () => {
    const { source } = await getCspHeader();
    expect(source).toBe("/:path*");
  });

  it("has no wildcard script or style sources", async () => {
    const { value } = await getCspHeader();
    const scriptSrc = value.match(/script-src ([^;]+);/)?.[1];
    const styleSrc = value.match(/style-src ([^;]+);/)?.[1];
    expect(scriptSrc).not.toContain("*");
    expect(scriptSrc).not.toContain("unsafe-eval");
    expect(styleSrc).not.toContain("*");
  });

  it("defaults every fetch/render directive to same-origin", async () => {
    const { value } = await getCspHeader();
    expect(value).toContain("default-src 'self'");
    expect(value).toContain("object-src 'none'");
    expect(value).toContain("base-uri 'self'");
    expect(value).toContain("form-action 'self'");
    expect(value).toContain("frame-ancestors 'none'");
  });

  it("allows XHR/fetch to Supabase for the browser client", async () => {
    const { value } = await getCspHeader();
    const connectSrc = value.match(/connect-src ([^;]+);/)?.[1];
    expect(connectSrc).toContain("'self'");
    expect(connectSrc).toContain("https://*.supabase.co");
  });
});
