import Link from "next/link";
import { RouteHeading } from "@/components/RouteHeading";

export default function RemixNotFound() {
  return (
    <main className="flex flex-1 flex-col items-start gap-3 px-6 py-6">
      <RouteHeading
        title="This poem isn’t open for remixing"
        description="Its poet hasn’t enabled remixing — or the link is mistyped, or the poem is no longer shared. You can still write a poem of your own."
        wrapperClassName={null}
      />
      <Link href="/" className="text-sm text-link underline underline-offset-2">
        Go to Poetic Fiddle
      </Link>
    </main>
  );
}
