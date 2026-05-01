"use client";

import { PageShell } from "@/components/layout/PageShell";
import { TxStatus } from "@/components/tx/TxStatus";
import { useAddressBook } from "@/config/addressBook";
import { servicingAbi } from "@/contracts/abis";
import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";

export default function ServicerPage() {
  const { address } = useAccount();
  const { value } = useAddressBook();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [invoiceId, setInvoiceId] = useState("1");
  const [paymentId, setPaymentId] = useState("0");
  const [hash, setHash] = useState<`0x${string}` | undefined>();

  const canFinalize = !!value.servicingRouter && !!address;

  return (
    <PageShell
      title="Servicer"
      subtitle="Finalize reported payments. This updates invoice repayment state and reduces outstanding exposures."
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
          <label className="grid gap-1">
            <div className="text-xs font-semibold text-zinc-200">Payment ID</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/30"
              value={paymentId}
              onChange={(e) => setPaymentId(e.target.value)}
            />
          </label>
          <div className="flex items-end">
            <button
              disabled={!canFinalize}
              className="w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 enabled:hover:bg-zinc-100 disabled:opacity-50"
              onClick={async () => {
                if (!value.servicingRouter || !address) return;
                const sim = await publicClient!.simulateContract({
                  address: value.servicingRouter,
                  abi: servicingAbi,
                  functionName: "finalizePayment",
                  args: [BigInt(invoiceId || "0"), BigInt(paymentId || "0")],
                  account: address,
                });
                const tx = await writeContractAsync(sim.request);
                setHash(tx);
              }}
            >
              Finalize
            </button>
          </div>
        </div>

        <TxStatus hash={hash} />
      </section>
    </PageShell>
  );
}

