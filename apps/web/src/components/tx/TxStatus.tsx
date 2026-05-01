"use client";

import { explorerTxUrl } from "@/config/chains";
import { useChainId, useWaitForTransactionReceipt } from "wagmi";

export function TxStatus({ hash }: { hash?: `0x${string}` }) {
  const chainId = useChainId();
  const { data, isLoading, isSuccess, isError, error } = useWaitForTransactionReceipt({
    hash,
    confirmations: 1,
    query: { enabled: !!hash },
  });

  if (!hash) return null;

  const explorer = explorerTxUrl(chainId, hash);

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-semibold text-zinc-200">Transaction</div>
        <button
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-semibold hover:bg-white/10"
          onClick={() => navigator.clipboard.writeText(hash)}
        >
          Copy hash
        </button>
      </div>
      <div className="mt-2 break-all text-zinc-300">{hash}</div>
      <div className="mt-2 text-zinc-300">
        {isLoading ? "Pending..." : null}
        {isSuccess ? `Confirmed in block ${data?.blockNumber?.toString()}` : null}
        {isError ? `Failed: ${error?.message ?? "unknown error"}` : null}
      </div>
      {explorer ? (
        <a className="mt-2 inline-block font-semibold text-white underline underline-offset-4" href={explorer} target="_blank" rel="noreferrer">
          View in explorer
        </a>
      ) : null}
    </div>
  );
}

