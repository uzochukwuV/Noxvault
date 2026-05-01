import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { TopNav } from "@/components/TopNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Noxvault",
  description: "Confidential receivables financing (invoice factoring) on iExec Nox",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-50">
        <Providers>
          <TopNav />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-white/10">
            <div className="mx-auto w-full max-w-6xl px-6 py-6 text-xs text-zinc-400">
              Confidential receivables financing demo built with iExec Nox.
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
