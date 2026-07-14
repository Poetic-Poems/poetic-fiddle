import { poeticCss } from "@/lib/poetic-css.generated";
import { EditorClient } from "@/components/EditorClient";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col gap-4">
      <div className="px-6 pt-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">
          Write your poem
        </h1>
        <p className="text-sm text-foreground/70">
          Edit on the left, watch the preview update on the right.
        </p>
      </div>
      <EditorClient poeticCss={poeticCss} />
    </main>
  );
}
