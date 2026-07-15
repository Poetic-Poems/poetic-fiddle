import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto flex items-center justify-center gap-2 px-6 py-6 text-xs text-foreground/60 sm:px-10">
      <Link
        href="/privacy"
        className="underline underline-offset-2 hover:text-foreground"
      >
        Privacy Policy
      </Link>
      <span aria-hidden="true">·</span>
      <Link
        href="/terms"
        className="underline underline-offset-2 hover:text-foreground"
      >
        Terms of Service
      </Link>
    </footer>
  );
}
