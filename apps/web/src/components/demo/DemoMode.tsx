"use client";

import { useState } from "react";

const steps = [
  { title: "Investor deposits liquidity", page: "/investor" },
  { title: "Issuer creates confidential invoice", page: "/issuer" },
  { title: "Operator funds invoice", page: "/operator" },
  { title: "Issuer repays & Servicer finalizes", page: "/servicer" },
  { title: "Issuer requests tier migration", page: "/issuer" },
  { title: "Admin approves tier migration", page: "/admin" },
  { title: "Disclosure officer grants Auditor view", page: "/admin" },
  { title: "Auditor views disclosed packet", page: "/auditor" },
];

export function DemoMode() {
  const [open, setOpen] = useState(true);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">Demo Mode</div>
          <div className="mt-1 text-xs text-zinc-300">A bank-style flow you can record in under 4 minutes.</div>
        </div>
        <button
          className="rounded-lg border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold hover:bg-black/40"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {open ? (
        <ol className="mt-4 grid gap-2 text-xs text-zinc-200">
          {steps.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-black/20 text-[11px] text-zinc-300">
                {i + 1}
              </div>
              <div className="leading-6">{s.title}</div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

