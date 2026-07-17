import Link from "next/link";

export default function RemixNotFound() {
  return (
    <main className="flex flex-1 flex-col items-start gap-3 px-6 py-6">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">
        This poem isn&rsquo;t open for remixing
      </h1>
      <p className="text-sm text-foreground/70">
        Its poet hasn&rsquo;t enabled remixing — or the link is mistyped, or the
        poem is no longer shared. You can still write a poem of your own.
      </p>
      <Link
        href="/"
        className="text-sm text-primary underline underline-offset-2"
      >
        Go to Poetic Fiddle
      </Link>
    </main>
  );
}
