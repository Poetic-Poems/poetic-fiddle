import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  define: {
    // Mirrors Next.js's build-time inlining of NEXT_PUBLIC_* vars, so
    // src/lib/supabase-client.ts can be imported under test without real
    // Supabase credentials.
    "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(
      "https://example.supabase.co",
    ),
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY":
      JSON.stringify("test-anon-key"),
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
