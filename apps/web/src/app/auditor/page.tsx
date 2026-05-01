"use client";

import { PageShell } from "@/components/layout/PageShell";
import { useAddressBook } from "@/config/addressBook";
import { invoiceRegistryAbi } from "@/contracts/abis";
import { useMemo, useState } from "react";
import { useAccount, useChainId, useReadContract } from "wagmi";

export default function AuditorPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { value } = useAddressBook();
  const [invoiceId, setInvoiceId] = useState("1");

  const invoice = useReadContract({
    address: value.invoiceRegistry,
    abi: invoiceRegistryAbi,
    functionName: "getInvoice",
    args: [BigInt(invoiceId || "0")],
    query: { enabled: !!value.invoiceRegistry && !!invoiceId },
  });

  const packet = useMemo(() => {
    const inv: any = invoice.data;
    if (!inv) return null;
    return {
      chainId,
      invoiceRegistry: value.invoiceRegistry,
      invoiceId,
      viewer: address,
      issuer: inv.issuer,
      status: Number(inv.status),
      riskTier: Number(inv.riskTier),
      invoiceRef: inv.invoiceRef,
      obligorHash: inv.obligorHash,
      obligorGroupHash: inv.obligorGroupHash,
      faceValueHandle: inv.faceValueEncrypted,
      fundedHandle: inv.fundedAmountEncrypted,
      repaidHandle: inv.repaidAmountEncrypted,
    };
  }, [invoice.data, chainId, value.invoiceRegistry, invoiceId, address]);

  return (
    <PageShell
      title="Auditor"
      subtitle="View invoice packets and exported audit evidence. This page shows handles and verifiable on-chain metadata."
    >
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-1">
            <div className="text-xs font-semibold text-zinc-200">Invoice ID</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/30"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
            />
          </label>
          <div className="md:col-span-2 flex items-end gap-2">
            <button
              disabled={!packet}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 enabled:hover:bg-zinc-100 disabled:opacity-50"
              onClick={() => {
                if (!packet) return;
                const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `noxvault-audit-invoice-${invoiceId}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export audit packet
            </button>
            <button
              disabled={!packet}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-white/10 disabled:opacity-50"
              onClick={() => packet && navigator.clipboard.writeText(JSON.stringify(packet))}
            >
              Copy JSON
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4 text-xs">
          <div className="font-semibold text-zinc-200">Invoice packet</div>
          <div className="mt-2 text-zinc-300">
            {invoice.isLoading ? "Loading..." : null}
            {invoice.isError ? "Failed to load invoice" : null}
          </div>
          {packet ? (
            <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-zinc-200">
              {JSON.stringify(packet, null, 2)}
            </pre>
          ) : null}
        </div>
      </section>
    </PageShell>
  );
}

