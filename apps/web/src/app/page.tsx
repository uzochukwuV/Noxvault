import Link from "next/link";
import { AddressStatus } from "@/components/address/AddressStatus";
import { DemoMode } from "@/components/demo/DemoMode";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-white/[0.02] p-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-200">
            Confidential DeFi + RWA
          </div>
          <h1 className="mt-5 text-balance text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
            Private receivables financing with verifiable origination and selective disclosure.
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-sm leading-7 text-zinc-300 md:text-base">
            Noxvault demonstrates invoice factoring end-to-end using iExec Nox Confidential Tokens (ERC-7984) and Nox
            Protocol compute. Amounts and positions are represented as confidential handles, while operational control
            stays on-chain.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-100"
              href="/issuer"
            >
              Start as Issuer
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
              href="/operator"
            >
              Start as Operator
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-transparent px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
              href="/investor"
            >
              Start as Investor
            </Link>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs text-zinc-400">Confidential</div>
              <div className="mt-1 text-sm font-semibold">Balances & amounts</div>
              <div className="mt-2 text-xs leading-6 text-zinc-300">
                Values are represented by encrypted handles. The UI does not attempt to decrypt unless explicitly
                disclosed.
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs text-zinc-400">Compliance-aware</div>
              <div className="mt-1 text-sm font-semibold">Selective disclosure</div>
              <div className="mt-2 text-xs leading-6 text-zinc-300">
                Auditors/regulators can be granted access to specific invoice and investor fields.
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs text-zinc-400">Bank-grade</div>
              <div className="mt-1 text-sm font-semibold">Risk policy</div>
              <div className="mt-2 text-xs leading-6 text-zinc-300">
                Pool/issuer/invoice caps plus concentration limits by obligor, group, and rating tier.
              </div>
            </div>
          </div>
        </section>

        <aside className="grid gap-6">
          <DemoMode />
          <AddressStatus />
        </aside>
      </div>
    </div>
  );
}
