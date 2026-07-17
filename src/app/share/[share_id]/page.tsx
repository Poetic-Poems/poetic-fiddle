import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { poeticCss } from "@/lib/poetic-css.generated";
import { getCachedSharedPoem } from "@/lib/shared-poem-cache";
import { renderSharedPoemHtml } from "@/lib/render-share";
import { SharedPoemView } from "@/components/SharedPoemView";

interface SharePageProps {
  params: Promise<{ share_id: string }>;
}

const FALLBACK_DESCRIPTION = "A poem shared via Poetic Fiddle.";

/**
 * Correct `<title>`/Open Graph meta for a shared poem (AC18), reusing the
 * already-derived `title` column rather than re-parsing `source_text` here
 * — that keeps this path simple and gives it nothing further to throw on.
 */
export async function generateMetadata({
  params,
}: SharePageProps): Promise<Metadata> {
  const { share_id: shareId } = await params;
  const poem = await getCachedSharedPoem(shareId);
  if (!poem) return { title: "Poem not found" };

  const title = poem.title || "Untitled poem";
  return {
    title,
    description: FALLBACK_DESCRIPTION,
    openGraph: { title, description: FALLBACK_DESCRIPTION, type: "article" },
  };
}

/**
 * The read-only SSR share view (AC17, AC18): no editor chrome, viewable
 * without client-side JS (AC84), and never a frozen snapshot — it reads
 * through `getCachedSharedPoem`, a short-lived cache invalidated on the
 * owner's next save (AC19, AC82).
 *
 * The one action it offers is Remix, and only when the poem's owner has
 * enabled it — globally or on this poem (D38, AC113). `allowRemix` arrives
 * already resolved against both settings by the `get_shared_poem` RPC, which
 * coalesces a missing value to `false`, so the default here is silence: no
 * Remix action, no hint that remixing exists.
 */
export default async function SharePage({ params }: SharePageProps) {
  const { share_id: shareId } = await params;
  const poem = await getCachedSharedPoem(shareId);
  if (!poem) notFound();

  const { html, error } = renderSharedPoemHtml(poem.source);
  const title = poem.title || "Untitled poem";

  return (
    <main className="flex flex-1 flex-col gap-4 px-6 py-6">
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          This poem couldn&rsquo;t be displayed right now.
        </p>
      ) : (
        <>
          <SharedPoemView html={html} css={poeticCss} title={title} />
          {poem.allowRemix && (
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/remix/${shareId}`}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white"
              >
                Remix
              </Link>
              <span className="text-sm text-foreground/70">
                Open your own copy to edit. The original stays as its poet wrote
                it.
              </span>
            </div>
          )}
        </>
      )}
    </main>
  );
}
