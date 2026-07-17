import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { poeticCss } from "@/lib/poetic-css.generated";
import { getCachedSharedPoem } from "@/lib/shared-poem-cache";
import { EditorClient } from "@/components/EditorClient";

interface RemixPageProps {
  params: Promise<{ share_id: string }>;
}

/**
 * A remix is a working copy, not a surface anyone should find from a search
 * result — the poem it came from is what's shareable (AC29, AC90).
 */
export const metadata: Metadata = {
  title: "Remix a poem",
  robots: { index: false, follow: false },
};

/**
 * Opens an independent copy of a shared poem in the editor (AC20). The copy
 * carries no poem id, so the first Save inserts a new row owned by whoever
 * is signed in and the original owner's poem is untouched; anonymous, it is
 * simply the editor's localStorage draft (AC21).
 *
 * `allowRemix` is re-checked here rather than trusted from the share page's
 * link: the permission is the owner's (D38), so it has to hold on the route
 * that acts on it, not only on the one that offers it. A poem whose owner
 * hasn't enabled remixing 404s exactly like an unknown share id (AC113) —
 * the two are deliberately indistinguishable, so a guessed URL confirms
 * nothing about which poems exist.
 */
export default async function RemixPage({ params }: RemixPageProps) {
  const { share_id: shareId } = await params;
  const poem = await getCachedSharedPoem(shareId);
  if (!poem?.allowRemix) notFound();

  return (
    <main className="flex flex-1 flex-col gap-4">
      <div className="px-6 pt-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">
          Remix this poem
        </h1>
        <p className="text-sm text-foreground/70">
          This is your own copy of{" "}
          <span className="font-medium">
            {poem.title || "an untitled poem"}
          </span>
          . Edits here are yours alone — the original is untouched.
        </p>
      </div>
      <EditorClient poeticCss={poeticCss} initialSource={poem.source} />
    </main>
  );
}
