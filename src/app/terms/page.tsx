import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Poetic Fiddle",
  description: "The terms that govern your use of Poetic Fiddle.",
};

export default function TermsOfService() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 sm:px-10">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">
          Terms of Service
        </h1>
        <p className="mt-1 text-sm text-foreground/70">
          Last updated 15 July 2026
        </p>
      </div>

      <div className="flex flex-col gap-6 text-sm leading-relaxed">
        <section>
          <h2 className="font-serif text-lg font-semibold">Who we are</h2>
          <p>
            Poetic Fiddle (<code>poeticfiddle.com</code>) is operated by W W
            Initiatives Limited, a New Zealand company trading as Datum Process
            (&ldquo;we&rdquo;, &ldquo;us&rdquo;). For any question about these
            terms, contact{" "}
            <a
              href="mailto:warwick@datumprocess.co.nz"
              className="text-link underline underline-offset-2"
            >
              warwick@datumprocess.co.nz
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">
            Acceptance of these terms
          </h2>
          <p>
            By using Poetic Fiddle you agree to these terms. If you don&rsquo;t
            agree to them, please don&rsquo;t use the service. See also our{" "}
            <Link
              href="/privacy"
              className="text-link underline underline-offset-2"
            >
              Privacy Policy
            </Link>
            , which explains what we collect and how it&rsquo;s used.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">The service</h2>
          <p>
            Poetic Fiddle is an early-stage web editor for the{" "}
            <code>.poem</code> format, with a live preview as you write. Save
            and Share, which will store a signed-in poet&rsquo;s poems in our
            database and let them be shared via a link, aren&rsquo;t available
            yet — until they are, poems written while signed out are kept only
            as an anonymous draft in your own browser.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">Accounts</h2>
          <ul className="mt-2 flex list-disc flex-col gap-2 pl-5">
            {/* prettier-ignore */}
            <li>
              <strong>Minimum age.</strong>{" "}
              You must be at least 16 years old to create a Poetic Fiddle
              account.
            </li>
            {/* prettier-ignore */}
            <li>
              <strong>Signing in.</strong>{" "}
              You can sign in with a magic-link email, a Google account, or
              an email and password, all handled by our authentication
              provider, Supabase.
            </li>
            {/* prettier-ignore */}
            <li>
              <strong>Account security.</strong>{" "}
              You&rsquo;re responsible for keeping your sign-in method secure
              and for what happens under your account. Tell us at{" "}
              <a
                href="mailto:warwick@datumprocess.co.nz"
                className="text-link underline underline-offset-2"
              >
                warwick@datumprocess.co.nz
              </a>{" "}
              if you think your account has been compromised.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">Your content</h2>
          <p>
            You own the poems you write in Poetic Fiddle, and keep the copyright
            in them. By using the service, you give us only the limited licence
            we need to run it: to store your poems and display them back to you,
            and — once Save and Share are live — to serve a poem to others via a
            share link you choose to create for it. We don&rsquo;t claim any
            broader rights over your work, and we won&rsquo;t use your poems for
            anything else.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">Acceptable use</h2>
          <p>
            Please don&rsquo;t use Poetic Fiddle to store or share unlawful
            content, or to abuse, disrupt, or attempt to gain unauthorised
            access to the service.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">
            Availability and warranty
          </h2>
          <p>
            Poetic Fiddle is an early-stage, hobby-scale service provided
            &ldquo;as is&rdquo;, without warranties of any kind. We don&rsquo;t
            guarantee uptime, and features (including ones described here) may
            change, be added, or be removed as the service develops.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">
            Limitation of liability
          </h2>
          <p>
            Poetic Fiddle is free to use and offered on a best-effort basis. To
            the extent the law allows, we aren&rsquo;t liable for any loss or
            damage arising from your use of the service, including lost poems or
            lost access to your account. If you keep the only copy of a poem in
            Poetic Fiddle, that&rsquo;s a risk worth weighing — we&rsquo;d
            encourage keeping your own copy too.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">Termination</h2>
          <p>
            You can delete your account and its data at any time by emailing{" "}
            <a
              href="mailto:warwick@datumprocess.co.nz"
              className="text-link underline underline-offset-2"
            >
              warwick@datumprocess.co.nz
            </a>
            , as set out in our{" "}
            <Link
              href="/privacy"
              className="text-link underline underline-offset-2"
            >
              Privacy Policy
            </Link>
            . We may suspend or terminate an account that abuses the service or
            breaches these terms.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">
            Changes to these terms
          </h2>
          <p>
            We&rsquo;ll update this page as Poetic Fiddle&rsquo;s features
            change, and update the date at the top when we do.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">Governing law</h2>
          <p>
            These terms are governed by New Zealand law, consistent with our{" "}
            <Link
              href="/privacy"
              className="text-link underline underline-offset-2"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </div>

      <p className="text-sm">
        <Link href="/" className="text-link underline underline-offset-2">
          Back to the editor
        </Link>
      </p>
    </main>
  );
}
