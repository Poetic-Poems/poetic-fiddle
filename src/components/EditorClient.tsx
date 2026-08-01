"use client";

import dynamic from "next/dynamic";

const Editor = dynamic(() => import("@/components/Editor"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center px-6 pb-6">
      <p role="status" className="text-sm text-foreground/70">
        Loading editor…
      </p>
    </div>
  ),
});

interface EditorClientProps {
  poeticCss: string;
  initialPoemId?: string;
  initialSource?: string;
}

export function EditorClient({
  poeticCss,
  initialPoemId,
  initialSource,
}: EditorClientProps) {
  return (
    <Editor
      poeticCss={poeticCss}
      initialPoemId={initialPoemId}
      initialSource={initialSource}
    />
  );
}
