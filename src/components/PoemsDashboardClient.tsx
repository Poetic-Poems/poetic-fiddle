"use client";

import dynamic from "next/dynamic";

const PoemsDashboard = dynamic(
  () => import("@/components/PoemsDashboard").then((mod) => mod.PoemsDashboard),
  { ssr: false },
);

export function PoemsDashboardClient() {
  return <PoemsDashboard />;
}
