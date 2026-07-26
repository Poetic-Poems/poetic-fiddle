"use client";

import { createContext, useContext } from "react";

const NonceContext = createContext<string | null>(null);

/**
 * Carries the per-request CSP nonce (src/proxy.ts) from the root layout —
 * the only place that can read the x-nonce request header — down to client
 * components nested below it, such as CodeMirror's EditorView.cspNonce
 * (TECH-DEBT.md TD26072101).
 */
export function NonceProvider({
  nonce,
  children,
}: {
  nonce: string | null;
  children: React.ReactNode;
}) {
  return (
    <NonceContext.Provider value={nonce}>{children}</NonceContext.Provider>
  );
}

// The nonce reaches the layout as a request header, and src/proxy.ts only
// overwrites that header on the paths its matcher covers — so a request the
// matcher skips can carry a client-supplied one. PoemPreview.tsx and
// SharedPoemView.tsx interpolate what they get straight into a srcDoc string,
// i.e. into markup, so anything that is not shaped like a nonce is treated as
// absent rather than written into an iframe. src/proxy.ts mints base64;
// base64url's `-`/`_` are allowed too so the check outlives that choice.
const NONCE_PATTERN = /^[A-Za-z0-9+/=_-]+$/;

/**
 * The current request's CSP nonce, or `null` when there is none to use — a
 * statically-built page, a path `src/proxy.ts`'s matcher excludes, or a value
 * that does not look like a nonce.
 */
export function useNonce() {
  const nonce = useContext(NonceContext);
  return nonce !== null && NONCE_PATTERN.test(nonce) ? nonce : null;
}
