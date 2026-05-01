"use client";

import { PageShell } from "@/components/layout/PageShell";
import { TxStatus } from "@/components/tx/TxStatus";
import { useAddressBook } from "@/config/addressBook";
import { invoiceRegistryAbi, noxComputeAbi, vaultAbi } from "@/contracts/abis";
import { computePublicHandle, uint256ToBytes32 } from "@/lib/crypto";
import { encodeAbiParameters, parseAbiParameters } from "viem";
import { useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";

const TEE_UINT256 = 35n;

export default function OperatorPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { value } = useAddressBook();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [invoiceId, setInvoiceId] = useState("1");
  const [fundAmount, setFundAmount] = useState("500000");
  const [fundHash, setFundHash] = useState<`0x${string}` | undefined>();

  const fundBig = useMemo(() => {
    try {
      return BigInt(fundAmount);
    } catch {
      return 0n;
    }
  }, [fundAmount]);

  const invoice = useReadContract({
    address: value.invoiceRegistry,
    abi: invoiceRegistryAbi,
    functionName: "getInvoice",
    args: [BigInt(invoiceId || "0")],
    query: { enabled: !!value.invoiceRegistry && !!invoiceId },
  });

  const canFund = !!value.vault && !!value.noxCompute && !!address && fundBig > 0n;

  return (
    <PageShell
      title="Operator"
      subtitle="Fund an invoice from the confidential vault. Risk enforcement is applied on-chain."
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
            <div className="text-xs font-semibold text-zinc-200">Funding amount</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/30"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
            />
          </label>
          <div className="flex items-end">
            <button
              disabled={!canFund}
              className="w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 enabled:hover:bg-zinc-100 disabled:opacity-50"
              onClick={async () => {
                if (!value.vault || !value.noxCompute || !address) return;

                const amtBytes = uint256ToBytes32(fundBig);
                const amountHandle = computePublicHandle(BigInt(chainId), TEE_UINT256, amtBytes) as `0x${string}`;

                const simCompute = await publicClient!.simulateContract({
                  address: value.noxCompute,
                  abi: noxComputeAbi,
                  functionName: "wrapAsPublicHandle",
                  args: [amtBytes, TEE_UINT256],
                  account: address,
                });
                await writeContractAsync(simCompute.request);

                const proofs: readonly `0x${string}`[] = ["0x01", "0x01", "0x01", "0x01", "0x01", "0x01"];
                const riskBundle = encodeAbiParameters(parseAbiParameters("bytes[] proofs"), [proofs]);

                const sim = await publicClient!.simulateContract({
                  address: value.vault,
                  abi: vaultAbi,
                  functionName: "fundInvoice",
                  args: [BigInt(invoiceId || "0"), amountHandle, "0x", riskBundle],
                  account: address,
                });
                const hash = await writeContractAsync(sim.request);
                setFundHash(hash);
              }}
            >
              Fund invoice
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4 text-xs">
          <div className="font-semibold text-zinc-200">Invoice snapshot</div>
          <div className="mt-2 text-zinc-300">
            {invoice.isLoading ? "Loading..." : null}
            {invoice.isError ? "Failed to load invoice" : null}
          </div>
          {invoice.data ? (
            <div className="mt-3 grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-zinc-400">Issuer</div>
                <div className="max-w-[65%] truncate text-zinc-200">{(invoice.data as any).issuer}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-zinc-400">Status</div>
                <div className="text-zinc-200">{Number((invoice.data as any).status)}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-zinc-400">Risk tier</div>
                <div className="text-zinc-200">{Number((invoice.data as any).riskTier)}</div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-zinc-400">Face value handle</div>
                <div className="max-w-[65%] truncate text-zinc-200">{(invoice.data as any).faceValueEncrypted}</div>
              </div>
            </div>
          ) : null}
        </div>

        <TxStatus hash={fundHash} />
      </section>
    </PageShell>
  );
}
