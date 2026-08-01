"use client";

import dynamic from "next/dynamic";

const PoemsDashboard = dynamic(
  () => import("@/components/PoemsDashboard").then((mod) => mod.PoemsDashboard),
  {
    ssr: false,
    loading: () => (
      <p role="status" className="px-6 text-sm text-foreground/70">
        Loading…
      </p>
    ),
  },
);

export function PoemsDashboardClient() {
  return <PoemsDashboard />;
}
