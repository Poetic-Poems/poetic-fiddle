import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Acceptable Use Policy — Poetic Fiddle",
  description: "What content and behaviour aren't allowed on Poetic Fiddle.",
};

export default function AcceptableUsePolicy() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 sm:px-10">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">
          Acceptable Use Policy
        </h1>
        <p className="mt-1 text-sm text-foreground/70">
          Last updated 23 July 2026
        </p>
      </div>

      <div className="flex flex-col gap-6 text-sm leading-relaxed">
        <section>
          <h2 className="font-serif text-lg font-semibold">Who we are</h2>
          <p>
            Poetic Fiddle (<code>poeticfiddle.com</code>) is operated by W W
            Initiatives Limited, a New Zealand company trading as Datum Process
            (&ldquo;we&rdquo;, &ldquo;us&rdquo;). For any question about this
            policy, contact{" "}
            <a
              href="mailto:warwick@datumprocess.co.nz"
              className="text-primary underline underline-offset-2"
            >
              warwick@datumprocess.co.nz
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">Scope</h2>
          <p>
            This policy applies to anyone using Poetic Fiddle — the poems you
            write, share, or store, and anything you do with your account. It
            works alongside our{" "}
            <Link
              href="/terms"
              className="text-primary underline underline-offset-2"
            >
              Terms of Service
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">
            What&rsquo;s not allowed
          </h2>
          <p>
            Please don&rsquo;t use Poetic Fiddle to store or share unlawful or
            infringing content, or to abuse, disrupt, or attempt to gain
            unauthorised access to the service.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">Enforcement</h2>
          <p>
            We may suspend or terminate an account that breaches this policy, as
            set out in our Terms of Service&rsquo;s{" "}
            <Link
              href="/terms"
              className="text-primary underline underline-offset-2"
            >
              Termination
            </Link>{" "}
            section.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">Related policies</h2>
          <p>
            See also our{" "}
            <Link
              href="/terms"
              className="text-primary underline underline-offset-2"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="text-primary underline underline-offset-2"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </div>

      <p className="text-sm">
        <Link href="/" className="text-primary underline underline-offset-2">
          Back to the editor
        </Link>
      </p>
    </main>
  );
}
