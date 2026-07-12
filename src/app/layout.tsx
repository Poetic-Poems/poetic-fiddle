import type { Metadata } from "next";
import { Geist, Fraunces } from "next/font/google";
import { BrandHeader } from "@/components/brand-header";
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
  title: "Poetic Fiddle",
  description: "A friendly web editor for the Poetic poem-authoring framework.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <BrandHeader />
        {children}
      </body>
    </html>
  );
}
