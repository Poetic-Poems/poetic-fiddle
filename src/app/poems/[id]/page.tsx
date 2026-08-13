import { poeticCss } from "@/lib/poetic-css.generated";
import { EditorClient } from "@/components/EditorClient";
import { RouteHeading } from "@/components/RouteHeading";

interface EditPoemPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPoemPage({ params }: EditPoemPageProps) {
  const { id } = await params;

  return (
    <main className="flex flex-1 flex-col gap-4">
      <RouteHeading
        title="Write your poem"
        description="Edit on the left, watch the preview update on the right."
      />
      <EditorClient poeticCss={poeticCss} initialPoemId={id} />
    </main>
  );
}
