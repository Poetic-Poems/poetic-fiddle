import { PoemsDashboardClient } from "@/components/PoemsDashboardClient";

export default function PoemsPage() {
  return (
    <main className="flex flex-1 flex-col gap-4">
      <div className="px-6 pt-6">
        {/* Programmatically focusable (not tab-reachable) so deleting the
            last poem has somewhere sensible to send focus (TD-PPpfid-26080102). */}
        <h1
          id="poems-heading"
          tabIndex={-1}
          className="font-serif text-2xl font-semibold tracking-tight"
        >
          My poems
        </h1>
        <p className="text-sm text-foreground/70">
          Your saved drafts. Pick one up where you left off.
        </p>
      </div>
      <PoemsDashboardClient />
    </main>
  );
}
