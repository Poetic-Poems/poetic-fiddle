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

export function useNonce() {
  return useContext(NonceContext);
}
