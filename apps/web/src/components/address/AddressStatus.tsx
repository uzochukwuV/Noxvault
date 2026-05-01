"use client";

import { useAddressBook } from "@/config/addressBook";
import { useMemo, useState } from "react";

const fields: Array<{ key: keyof ReturnType<typeof useAddressBook>["value"]; label: string }> = [
  { key: "invoiceRegistry", label: "InvoiceRegistry" },
  { key: "vault", label: "Vault" },
  { key: "servicingRouter", label: "ServicingRouter" },
  { key: "riskManager", label: "RiskManager" },
  { key: "policyPack", label: "RiskPolicyPack" },
  { key: "disclosureManager", label: "DisclosureManager" },
  { key: "verifier", label: "InvoiceVerifier" },
  { key: "wrapper", label: "Cash Wrapper" },
  { key: "usdc", label: "USDC (optional)" },
  { key: "noxCompute", label: "NoxCompute" },
];

export function AddressStatus() {
  const { supported, value, save, clear, override } = useAddressBook();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => ({ ...(override ?? {}) }));

  const missing = useMemo(() => {
    return fields
      .filter((f) => f.key !== "usdc" && f.key !== "noxCompute")
      .filter((f) => !value[f.key])
      .map((f) => f.label);
  }, [value]);

  if (!supported) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-semibold">Addresses</div>
        <div className="mt-2 text-xs leading-6 text-zinc-300">
          Unsupported network. Switch to Local Hardhat or Arbitrum Sepolia.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">Addresses</div>
          <div className="mt-1 text-xs text-zinc-300">
            {missing.length === 0 ? "Configured" : `Missing: ${missing.join(", ")}`}
          </div>
        </div>
        <button
          className="rounded-lg border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold hover:bg-black/40"
          onClick={() => {
            setDraft({ ...(override ?? {}) });
            setOpen((v) => !v);
          }}
        >
          {open ? "Close" : "Edit"}
        </button>
      </div>

      <div className="mt-4 grid gap-2">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-3">
            <div className="text-xs text-zinc-400">{f.label}</div>
            <div className="max-w-[65%] truncate text-xs text-zinc-200">
              {value[f.key] ? value[f.key] : "—"}
            </div>
          </div>
        ))}
      </div>

      {open ? (
        <div className="mt-5 border-t border-white/10 pt-5">
          <div className="grid gap-3">
            {fields.map((f) => (
              <label key={f.key} className="grid gap-1">
                <div className="text-xs font-semibold text-zinc-200">{f.label}</div>
                <input
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-100 outline-none focus:border-white/30"
                  placeholder="0x..."
                  value={(draft as any)[f.key] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...(d as any), [f.key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-100"
              onClick={() => save(draft as any)}
            >
              Save
            </button>
            <button
              className="rounded-xl border border-white/10 bg-transparent px-4 py-2 text-xs font-semibold text-white hover:bg-white/5"
              onClick={clear}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

