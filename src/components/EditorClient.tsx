"use client";

import dynamic from "next/dynamic";

const Editor = dynamic(() => import("@/components/Editor"), { ssr: false });

interface EditorClientProps {
  poeticCss: string;
}

export function EditorClient({ poeticCss }: EditorClientProps) {
  return <Editor poeticCss={poeticCss} />;
}
