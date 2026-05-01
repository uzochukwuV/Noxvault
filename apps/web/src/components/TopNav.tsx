"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function TopNav() {
  return (
    <header className="border-b border-white/10">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-5">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-semibold tracking-wide">
            Noxvault
          </Link>
          <nav className="hidden items-center gap-3 text-sm text-zinc-300 md:flex">
            <Link className="hover:text-zinc-50" href="/investor">
              Investor
            </Link>
            <Link className="hover:text-zinc-50" href="/issuer">
              Issuer
            </Link>
            <Link className="hover:text-zinc-50" href="/operator">
              Operator
            </Link>
            <Link className="hover:text-zinc-50" href="/servicer">
              Servicer
            </Link>
            <Link className="hover:text-zinc-50" href="/admin">
              Admin
            </Link>
            <Link className="hover:text-zinc-50" href="/auditor">
              Auditor
            </Link>
          </nav>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}

