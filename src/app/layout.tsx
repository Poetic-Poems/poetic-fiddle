import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Fraunces } from "next/font/google";
import { BrandHeader } from "@/components/brand-header";
import { SiteFooter } from "@/components/site-footer";
import { NonceProvider } from "@/lib/nonce-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.poeticfiddle.com"),
  title: "Poetic Fiddle",
  description: "A friendly web editor for the Poetic poem-authoring framework.",
  applicationName: "Poetic Fiddle",
  openGraph: {
    siteName: "Poetic Fiddle",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Set by src/proxy.ts on every request; reading it here (rather than only
  // in src/proxy.ts) is also what opts every route into dynamic rendering,
  // which a nonce-based CSP requires (a statically-built page has no request
  // to mint a nonce from). See TECH-DEBT.md TD26072101.
  const nonce = (await headers()).get("x-nonce");

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <NonceProvider nonce={nonce}>
          <BrandHeader />
          {children}
          <SiteFooter />
        </NonceProvider>
      </body>
    </html>
  );
}
