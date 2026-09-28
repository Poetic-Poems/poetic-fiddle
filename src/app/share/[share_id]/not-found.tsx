import Link from "next/link";
import { RouteHeading } from "@/components/RouteHeading";

export default function ShareNotFound() {
  return (
    <main className="flex flex-1 flex-col items-start gap-3 px-6 py-6">
      <RouteHeading
        title="Poem not found"
        description="This link may be mistyped, or the poem is no longer shared."
        wrapperClassName={null}
      />
      <Link href="/" className="text-sm text-link underline underline-offset-2">
        Go to Poetic Fiddle
      </Link>
    </main>
  );
}
