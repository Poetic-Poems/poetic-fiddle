import Link from "next/link";

export default function ShareNotFound() {
  return (
    <main className="flex flex-1 flex-col items-start gap-3 px-6 py-6">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">
        Poem not found
      </h1>
      <p className="text-sm text-foreground/70">
        This link may be mistyped, or the poem is no longer shared.
      </p>
      <Link href="/" className="text-sm text-link underline underline-offset-2">
        Go to Poetic Fiddle
      </Link>
    </main>
  );
}
