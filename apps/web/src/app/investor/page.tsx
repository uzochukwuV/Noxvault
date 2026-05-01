"use client";

import { PageShell } from "@/components/layout/PageShell";
import { TxStatus } from "@/components/tx/TxStatus";
import { useAddressBook } from "@/config/addressBook";
import { erc20Abi, wrapperAbi } from "@/contracts/abis";
import { useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";

export default function InvestorPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { value } = useAddressBook();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState("2000000");
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const [wrapHash, setWrapHash] = useState<`0x${string}` | undefined>();
  const [depositHash, setDepositHash] = useState<`0x${string}` | undefined>();
  const [mintedHandle, setMintedHandle] = useState<`0x${string}` | undefined>();

  const amountBig = useMemo(() => {
    try {
      return BigInt(amount);
    } catch {
      return 0n;
    }
  }, [amount]);

  const canApprove = !!value.usdc && !!value.wrapper && amountBig > 0n;
  const canWrap = !!value.wrapper && !!address && amountBig > 0n;
  const canDeposit = !!value.wrapper && !!value.vault && !!mintedHandle;

  return (
    <PageShell
      title="Investor"
      subtitle="Deposit liquidity into the confidential vault. Amounts become confidential handles once wrapped."
    >
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1">
            <div className="text-xs font-semibold text-zinc-200">Amount (base units)</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/30"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="2000000"
            />
          </label>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-zinc-400">Connected</div>
            <div className="mt-1 break-all text-xs text-zinc-200">{address ?? "—"}</div>
            <div className="mt-3 text-xs text-zinc-400">Chain</div>
            <div className="mt-1 text-xs text-zinc-200">{chainId}</div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            disabled={!canApprove}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 enabled:hover:bg-zinc-100 disabled:opacity-50"
            onClick={async () => {
              if (!value.usdc || !value.wrapper) return;
              const hash = await writeContractAsync({
                address: value.usdc,
                abi: erc20Abi,
                functionName: "approve",
                args: [value.wrapper, amountBig],
              });
              setApproveHash(hash);
            }}
          >
            Approve
          </button>
          <button
            disabled={!canWrap}
            className="rounded-xl border border-white/10 bg-transparent px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-white/5 disabled:opacity-50"
            onClick={async () => {
              if (!value.wrapper || !address) return;
              const sim = await publicClient!.simulateContract({
                address: value.wrapper,
                abi: wrapperAbi,
                functionName: "wrap",
                args: [address, amountBig],
                account: address,
              });
              const out = sim.result as `0x${string}`;
              const hash = await writeContractAsync(sim.request);
              setMintedHandle(out);
              setWrapHash(hash);
            }}
          >
            Wrap to handle
          </button>
          <button
            disabled={!canDeposit}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-white/10 disabled:opacity-50"
            onClick={async () => {
              if (!value.wrapper || !value.vault || !mintedHandle) return;
              const sim = await publicClient!.simulateContract({
                address: value.wrapper,
                abi: wrapperAbi,
                functionName: "confidentialTransferAndCall",
                args: [value.vault, mintedHandle, "0x"],
                account: address!,
              });
              const hash = await writeContractAsync(sim.request);
              setDepositHash(hash);
            }}
          >
            Deposit to vault
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4 text-xs">
          <div className="font-semibold text-zinc-200">Minted handle</div>
          <div className="mt-2 break-all text-zinc-300">{mintedHandle ?? "—"}</div>
        </div>

        <TxStatus hash={approveHash} />
        <TxStatus hash={wrapHash} />
        <TxStatus hash={depositHash} />
      </section>
    </PageShell>
  );
}

