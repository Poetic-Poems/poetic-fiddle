import { PoemsDashboardClient } from "@/components/PoemsDashboardClient";
import { RouteHeading } from "@/components/RouteHeading";

export default function PoemsPage() {
  return (
    <main className="flex flex-1 flex-col gap-4">
      {/* Programmatically focusable (not tab-reachable) so deleting the
          last poem has somewhere sensible to send focus (TD-PPpfid-26080102). */}
      <RouteHeading
        title="My poems"
        description="Your saved drafts. Pick one up where you left off."
        headingId="poems-heading"
        headingTabIndex={-1}
      />
      <PoemsDashboardClient />
    </main>
  );
}
