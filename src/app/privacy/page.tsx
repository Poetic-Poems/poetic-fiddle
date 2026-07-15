import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Poetic Fiddle",
  description: "How Poetic Fiddle collects, uses, and protects your data.",
};

export default function PrivacyPolicy() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10 sm:px-10">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">
          Privacy Policy
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
            (&ldquo;we&rdquo;, &ldquo;us&rdquo;). For any question about this
            policy or your data, contact{" "}
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
          <h2 className="font-serif text-lg font-semibold">What we collect</h2>
          <ul className="mt-2 flex list-disc flex-col gap-2 pl-5">
            {/* prettier-ignore */}
            <li>
              <strong>Account information.</strong>{" "}
              If you sign in, your email address, and, if you choose
              &ldquo;Continue with Google&rdquo;, the basic profile Google
              shares for sign-in (name, email address, profile picture). This
              is handled by our authentication provider, Supabase.
            </li>
            {/* prettier-ignore */}
            <li>
              <strong>Poems you write.</strong>{" "}
              The text of poems you author in the editor.
            </li>
            {/* prettier-ignore */}
            <li>
              <strong>Anonymous drafts.</strong>{" "}
              While you are not signed in, your in-progress poem is kept only
              in your own browser (using <code> localStorage</code>) — it is
              never sent to our servers. Signing in for the first time moves
              that draft into your account and clears it from the browser.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">
            Signing in with Google
          </h2>
          <p>
            Google sign-in requests only the non-sensitive <code>openid</code>,{" "}
            <code>email</code>, and <code>profile</code> scopes, so we can
            identify you and show your email address once signed in. We
            don&rsquo;t request or access anything else in your Google account.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">
            Saving and sharing poems
          </h2>
          <p>
            Poetic Fiddle&rsquo;s Save and Share actions are designed to store a
            signed-in poet&rsquo;s poem content in our database and let it be
            shared via a link. As of this policy&rsquo;s last update, that
            storage isn&rsquo;t available yet — this section will be updated
            once it is, and you&rsquo;ll be able to delete an individual poem or
            your whole account (and everything in it) at any time.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">
            Cookies and tracking
          </h2>
          <p>
            We set only the essential cookie our authentication provider
            (Supabase) uses to keep you signed in. We use no third-party
            analytics or advertising trackers, so no cookie-consent banner is
            needed.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">
            Who we share data with
          </h2>
          <p>
            We share data only with the processors that run the service, and
            only for that purpose:
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-2 pl-5">
            <li>
              <strong>Supabase</strong> — our database, authentication, and
              storage provider. Our project is hosted in the Southeast Asia
              (Singapore) region.
            </li>
            <li>
              <strong>Vercel</strong> — hosts the web app.
            </li>
            <li>
              <strong>Google</strong> — only if you choose to sign in with
              Google.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">Your rights</h2>
          <p>
            You can ask us to export or delete your data, or delete your account
            entirely, at any time by emailing{" "}
            <a
              href="mailto:warwick@datumprocess.co.nz"
              className="text-primary underline underline-offset-2"
            >
              warwick@datumprocess.co.nz
            </a>
            . We keep account and poem data only for as long as your account
            exists.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">Minimum age</h2>
          <p>
            You must be at least 16 years old to create a Poetic Fiddle account.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">
            Legal basis and jurisdiction
          </h2>
          <p>
            We handle personal data under the New Zealand Privacy Act 2020, and
            aim to meet GDPR/UK GDPR expectations for poets elsewhere, as our
            poets may be anywhere in the world.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">
            Changes to this policy
          </h2>
          <p>
            We&rsquo;ll update this page as Poetic Fiddle&rsquo;s features
            change, and update the date at the top when we do.
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
