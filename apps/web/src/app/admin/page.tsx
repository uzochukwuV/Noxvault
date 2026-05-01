"use client";

import { PageShell } from "@/components/layout/PageShell";
import { TxStatus } from "@/components/tx/TxStatus";
import { useAddressBook } from "@/config/addressBook";
import { disclosureAbi, invoiceRegistryAbi } from "@/contracts/abis";
import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";

export default function AdminPage() {
  const { address } = useAccount();
  const { value } = useAddressBook();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [invoiceId, setInvoiceId] = useState("1");
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();

  const [viewer, setViewer] = useState("");
  const [fieldsMask, setFieldsMask] = useState("1");
  const [discloseInvoiceHash, setDiscloseInvoiceHash] = useState<`0x${string}` | undefined>();

  const [investor, setInvestor] = useState("");
  const [discloseSharesHash, setDiscloseSharesHash] = useState<`0x${string}` | undefined>();

  const canApprove = !!value.invoiceRegistry && !!address;
  const canDiscloseInvoice = !!value.disclosureManager && !!value.invoiceRegistry && !!viewer && !!address;
  const canDiscloseShares = !!value.disclosureManager && !!value.vault && !!investor && !!viewer && !!address;

  return (
    <PageShell
      title="Admin"
      subtitle="Approve tier migrations and grant selective disclosure to auditors/regulators."
    >
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-semibold">Approve tier migration</div>
        <div className="mt-2 text-xs leading-6 text-zinc-300">
          Issuer requests a tier change; Admin approves and the protocol re-buckets outstanding exposure.
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="grid gap-1">
            <div className="text-xs font-semibold text-zinc-200">Invoice ID</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/30"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
            />
          </label>
          <div className="md:col-span-2 flex items-end">
            <button
              disabled={!canApprove}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 enabled:hover:bg-zinc-100 disabled:opacity-50"
              onClick={async () => {
                if (!value.invoiceRegistry || !address) return;
                const sim = await publicClient!.simulateContract({
                  address: value.invoiceRegistry,
                  abi: invoiceRegistryAbi,
                  functionName: "approveRiskTierMigration",
                  args: [BigInt(invoiceId || "0")],
                  account: address,
                });
                const hash = await writeContractAsync(sim.request);
                setApproveHash(hash);
              }}
            >
              Approve
            </button>
          </div>
        </div>

        <TxStatus hash={approveHash} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-semibold">Disclose invoice fields</div>
        <div className="mt-2 text-xs leading-6 text-zinc-300">
          Grants a viewer access to selected invoice encrypted handles. fieldsMask is protocol-defined.
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="grid gap-1">
            <div className="text-xs font-semibold text-zinc-200">Viewer address</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/30"
              value={viewer}
              onChange={(e) => setViewer(e.target.value)}
              placeholder="0x..."
            />
          </label>
          <label className="grid gap-1">
            <div className="text-xs font-semibold text-zinc-200">Invoice ID</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/30"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
            />
          </label>
          <label className="grid gap-1">
            <div className="text-xs font-semibold text-zinc-200">fieldsMask</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/30"
              value={fieldsMask}
              onChange={(e) => setFieldsMask(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-4">
          <button
            disabled={!canDiscloseInvoice}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-white/10 disabled:opacity-50"
            onClick={async () => {
              if (!value.disclosureManager || !value.invoiceRegistry || !address) return;
              const sim = await publicClient!.simulateContract({
                address: value.disclosureManager,
                abi: disclosureAbi,
                functionName: "discloseInvoice",
                args: [value.invoiceRegistry, BigInt(invoiceId || "0"), viewer as `0x${string}`, BigInt(fieldsMask || "0")],
                account: address,
              });
              const hash = await writeContractAsync(sim.request);
              setDiscloseInvoiceHash(hash);
            }}
          >
            Disclose invoice
          </button>
        </div>

        <TxStatus hash={discloseInvoiceHash} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-semibold">Disclose investor shares</div>
        <div className="mt-2 text-xs leading-6 text-zinc-300">
          Grants a viewer access to the investor share handle(s) for a specific vault/investor.
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1">
            <div className="text-xs font-semibold text-zinc-200">Investor address</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/30"
              value={investor}
              onChange={(e) => setInvestor(e.target.value)}
              placeholder="0x..."
            />
          </label>
          <label className="grid gap-1">
            <div className="text-xs font-semibold text-zinc-200">Viewer address</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/30"
              value={viewer}
              onChange={(e) => setViewer(e.target.value)}
              placeholder="0x..."
            />
          </label>
        </div>

        <div className="mt-4">
          <button
            disabled={!canDiscloseShares}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-white/10 disabled:opacity-50"
            onClick={async () => {
              if (!value.disclosureManager || !value.vault || !address) return;
              const sim = await publicClient!.simulateContract({
                address: value.disclosureManager,
                abi: disclosureAbi,
                functionName: "discloseInvestorShares",
                args: [value.vault, investor as `0x${string}`, viewer as `0x${string}`],
                account: address,
              });
              const hash = await writeContractAsync(sim.request);
              setDiscloseSharesHash(hash);
            }}
          >
            Disclose shares
          </button>
        </div>

        <TxStatus hash={discloseSharesHash} />
      </section>
    </PageShell>
  );
}

