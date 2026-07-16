"use client";

import dynamic from "next/dynamic";

const Editor = dynamic(() => import("@/components/Editor"), { ssr: false });

interface EditorClientProps {
  poeticCss: string;
  initialPoemId?: string;
}

export function EditorClient({ poeticCss, initialPoemId }: EditorClientProps) {
  return <Editor poeticCss={poeticCss} initialPoemId={initialPoemId} />;
}
