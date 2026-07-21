import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

function getCsp(response: Response) {
  const value = response.headers.get("Content-Security-Policy");
  if (!value) throw new Error("No Content-Security-Policy header found");
  return value;
}

function run(url = "https://example.com/") {
  return proxy(new NextRequest(url));
}

describe("proxy's Content-Security-Policy", () => {
  it("has no wildcard or unsafe-inline script or style sources", () => {
    const value = getCsp(run());
    const scriptSrc = value.match(/script-src ([^;]+);/)?.[1];
    const styleSrc = value.match(/style-src ([^;]+);/)?.[1];
    expect(scriptSrc).not.toContain("*");
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
    expect(styleSrc).not.toContain("*");
    expect(styleSrc).not.toContain("unsafe-inline");
  });

  it("carries the same nonce in script-src and style-src", () => {
    const value = getCsp(run());
    const scriptNonce = value.match(/script-src 'self' 'nonce-([^']+)'/)?.[1];
    const styleNonce = value.match(/style-src 'self' 'nonce-([^']+)'/)?.[1];
    expect(scriptNonce).toBeTruthy();
    expect(scriptNonce).toBe(styleNonce);
  });

  it("mints a different nonce for every request", () => {
    expect(getCsp(run())).not.toBe(getCsp(run()));
  });

  it("defaults every fetch/render directive to same-origin", () => {
    const value = getCsp(run());
    expect(value).toContain("default-src 'self'");
    expect(value).toContain("object-src 'none'");
    expect(value).toContain("base-uri 'self'");
    expect(value).toContain("form-action 'self'");
    expect(value).toContain("frame-ancestors 'none'");
  });

  it("allows XHR/fetch to Supabase for the browser client", () => {
    const value = getCsp(run());
    const connectSrc = value.match(/connect-src ([^;]+);/)?.[1];
    expect(connectSrc).toContain("'self'");
    expect(connectSrc).toContain("https://*.supabase.co");
  });

  it("forwards the same nonce to the app via the x-nonce request header", () => {
    const response = run();
    const nonce = getCsp(response).match(
      /script-src 'self' 'nonce-([^']+)'/,
    )?.[1];
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
  });
});
