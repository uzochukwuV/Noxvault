"use client";

import { PageShell } from "@/components/layout/PageShell";
import { TxStatus } from "@/components/tx/TxStatus";
import { useAddressBook } from "@/config/addressBook";
import { invoiceRegistryAbi, noxComputeAbi, wrapperAbi } from "@/contracts/abis";
import { computePublicHandle, uint256ToBytes32 } from "@/lib/crypto";
import { encodeAbiParameters, keccak256, parseAbiParameters, toHex } from "viem";
import { useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSignTypedData,
  useWriteContract,
} from "wagmi";

const TEE_UINT256 = 35n;

export default function IssuerPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { value } = useAddressBook();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();

  const [faceValue, setFaceValue] = useState("1000000");
  const [daysToDue, setDaysToDue] = useState("30");
  const [invoiceRefText, setInvoiceRefText] = useState("inv-demo-1");
  const [obligorText, setObligorText] = useState("obligor-acme-lei-123");
  const [groupText, setGroupText] = useState("obligor-group-acme-holdco");
  const [riskTier, setRiskTier] = useState("2");
  const [metadataText, setMetadataText] = useState("invoice-metadata-demo");

  const [auditorSig, setAuditorSig] = useState<`0x${string}` | undefined>();
  const [createHash, setCreateHash] = useState<`0x${string}` | undefined>();
  const [repayHash, setRepayHash] = useState<`0x${string}` | undefined>();
  const [tierReqHash, setTierReqHash] = useState<`0x${string}` | undefined>();

  const [invoiceId, setInvoiceId] = useState("1");
  const [repayAmount, setRepayAmount] = useState("200000");
  const [newTier, setNewTier] = useState("3");

  const faceValueBig = useMemo(() => {
    try {
      return BigInt(faceValue);
    } catch {
      return 0n;
    }
  }, [faceValue]);

  const repayBig = useMemo(() => {
    try {
      return BigInt(repayAmount);
    } catch {
      return 0n;
    }
  }, [repayAmount]);

  const dueDate = useMemo(() => {
    const days = Number(daysToDue || "0");
    const now = Math.floor(Date.now() / 1000);
    return BigInt(now + Math.max(0, days) * 24 * 60 * 60);
  }, [daysToDue]);

  const invoiceRef = useMemo(() => keccak256(toHex(invoiceRefText)), [invoiceRefText]);
  const obligorHash = useMemo(() => keccak256(toHex(obligorText)), [obligorText]);
  const obligorGroupHash = useMemo(() => keccak256(toHex(groupText)), [groupText]);
  const metadataHash = useMemo(() => keccak256(toHex(metadataText)), [metadataText]);

  const tier = useMemo(() => Number(riskTier || "0"), [riskTier]);

  const canSign = !!value.verifier && !!address;
  const canCreate =
    !!value.invoiceRegistry &&
    !!value.verifier &&
    !!value.noxCompute &&
    !!auditorSig &&
    !!address &&
    faceValueBig > 0n;

  const canRepay = !!value.wrapper && !!value.vault && !!value.noxCompute && !!address && repayBig > 0n;
  const canRequestTier = !!value.invoiceRegistry && !!address;

  return (
    <PageShell
      title="Issuer"
      subtitle="Create confidential invoices (auditor-signed), repay via confidential transfer-and-call, and request tier migration."
    >
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-semibold">1) Auditor signature (EIP-712)</div>
        <div className="mt-2 text-xs leading-6 text-zinc-300">
          Connect as the Auditor wallet, sign the invoice proof, then switch back to the Issuer wallet to submit.
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="grid gap-1 md:col-span-1">
            <div className="text-xs font-semibold text-zinc-200">Face value</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/30"
              value={faceValue}
              onChange={(e) => setFaceValue(e.target.value)}
            />
          </label>
          <label className="grid gap-1">
            <div className="text-xs font-semibold text-zinc-200">Days to due</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/30"
              value={daysToDue}
              onChange={(e) => setDaysToDue(e.target.value)}
            />
          </label>
          <label className="grid gap-1">
            <div className="text-xs font-semibold text-zinc-200">Risk tier</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/30"
              value={riskTier}
              onChange={(e) => setRiskTier(e.target.value)}
            />
          </label>
          <label className="grid gap-1 md:col-span-3">
            <div className="text-xs font-semibold text-zinc-200">Invoice ref</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/30"
              value={invoiceRefText}
              onChange={(e) => setInvoiceRefText(e.target.value)}
            />
          </label>
          <label className="grid gap-1 md:col-span-3">
            <div className="text-xs font-semibold text-zinc-200">Obligor</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/30"
              value={obligorText}
              onChange={(e) => setObligorText(e.target.value)}
            />
          </label>
          <label className="grid gap-1 md:col-span-3">
            <div className="text-xs font-semibold text-zinc-200">Obligor group</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/30"
              value={groupText}
              onChange={(e) => setGroupText(e.target.value)}
            />
          </label>
          <label className="grid gap-1 md:col-span-3">
            <div className="text-xs font-semibold text-zinc-200">Metadata</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/30"
              value={metadataText}
              onChange={(e) => setMetadataText(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            disabled={!canSign}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 enabled:hover:bg-zinc-100 disabled:opacity-50"
            onClick={async () => {
              if (!value.verifier || !address) return;
              const validUntil = BigInt(Math.floor(Date.now() / 1000) + 24 * 60 * 60);
              const faceValueHandle = computePublicHandle(BigInt(chainId), TEE_UINT256, uint256ToBytes32(faceValueBig));
              const sig = (await signTypedDataAsync({
                domain: {
                  name: "ConfidentialInvoiceProof",
                  version: "1",
                  chainId,
                  verifyingContract: value.verifier,
                },
                types: {
                  ConfidentialInvoiceProof: [
                    { name: "issuer", type: "address" },
                    { name: "faceValueHandle", type: "bytes32" },
                    { name: "dueDate", type: "uint64" },
                    { name: "settlementRecipient", type: "address" },
                    { name: "metadataHash", type: "bytes32" },
                    { name: "invoiceRef", type: "bytes32" },
                    { name: "obligorHash", type: "bytes32" },
                    { name: "obligorGroupHash", type: "bytes32" },
                    { name: "riskTier", type: "uint8" },
                    { name: "validUntil", type: "uint64" },
                  ],
                },
                primaryType: "ConfidentialInvoiceProof",
                message: {
                  issuer: address,
                  faceValueHandle,
                  dueDate,
                  settlementRecipient: address,
                  metadataHash,
                  invoiceRef,
                  obligorHash,
                  obligorGroupHash,
                  riskTier: tier,
                  validUntil,
                },
              })) as `0x${string}`;
              setAuditorSig(sig);
            }}
          >
            Sign as Auditor
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4 text-xs">
          <div className="font-semibold text-zinc-200">Auditor signature</div>
          <div className="mt-2 break-all text-zinc-300">{auditorSig ?? "—"}</div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-semibold">2) Create confidential invoice</div>
        <div className="mt-2 text-xs leading-6 text-zinc-300">
          This submits the auditor signature as proof and stores the confidential face value handle.
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            disabled={!canCreate}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 enabled:hover:bg-zinc-100 disabled:opacity-50"
            onClick={async () => {
              if (!value.invoiceRegistry || !value.verifier || !value.noxCompute || !auditorSig || !address) return;

              const faceValueBytes = uint256ToBytes32(faceValueBig);
              const faceValueHandle = computePublicHandle(BigInt(chainId), TEE_UINT256, faceValueBytes) as `0x${string}`;

              const simCompute = await publicClient!.simulateContract({
                address: value.noxCompute,
                abi: noxComputeAbi,
                functionName: "wrapAsPublicHandle",
                args: [faceValueBytes, TEE_UINT256],
                account: address,
              });
              await writeContractAsync(simCompute.request);

              const validUntil = BigInt(Math.floor(Date.now() / 1000) + 24 * 60 * 60);
              const proof = encodeAbiParameters(parseAbiParameters("uint64 validUntil, bytes signature"), [
                validUntil,
                auditorSig,
              ]);

              const sim = await publicClient!.simulateContract({
                address: value.invoiceRegistry,
                abi: invoiceRegistryAbi,
                functionName: "createInvoiceConfidential",
                args: [
                  faceValueHandle,
                  "0x",
                  dueDate,
                  address,
                  metadataHash,
                  invoiceRef,
                  obligorHash,
                  obligorGroupHash,
                  tier,
                  value.verifier,
                  proof,
                ],
                account: address,
              });
              const hash = await writeContractAsync(sim.request);
              setCreateHash(hash);
            }}
          >
            Create invoice
          </button>
        </div>

        <TxStatus hash={createHash} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-semibold">3) Repay invoice</div>
        <div className="mt-2 text-xs leading-6 text-zinc-300">
          Repayment uses the cash wrapper to confidentially transfer a repayment handle to the vault, encoding the
          invoiceId.
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
          <label className="grid gap-1">
            <div className="text-xs font-semibold text-zinc-200">Repay amount</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/30"
              value={repayAmount}
              onChange={(e) => setRepayAmount(e.target.value)}
            />
          </label>
          <div className="flex items-end">
            <button
              disabled={!canRepay}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-white/10 disabled:opacity-50"
              onClick={async () => {
                if (!value.wrapper || !value.vault || !value.noxCompute || !address) return;

                const repayBytes = uint256ToBytes32(repayBig);
                const repayHandle = computePublicHandle(BigInt(chainId), TEE_UINT256, repayBytes) as `0x${string}`;

                const simCompute = await publicClient!.simulateContract({
                  address: value.noxCompute,
                  abi: noxComputeAbi,
                  functionName: "wrapAsPublicHandle",
                  args: [repayBytes, TEE_UINT256],
                  account: address,
                });
                await writeContractAsync(simCompute.request);

                const invoiceIdBig = BigInt(invoiceId || "0");
                const data = encodeAbiParameters(parseAbiParameters("uint256 invoiceId"), [invoiceIdBig]);

                const sim = await publicClient!.simulateContract({
                  address: value.wrapper,
                  abi: wrapperAbi,
                  functionName: "confidentialTransferAndCall",
                  args: [value.vault, repayHandle, data],
                  account: address,
                });
                const hash = await writeContractAsync(sim.request);
                setRepayHash(hash);
              }}
            >
              Repay
            </button>
          </div>
        </div>

        <TxStatus hash={repayHash} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-semibold">4) Request tier migration</div>
        <div className="mt-2 text-xs leading-6 text-zinc-300">
          Issuer requests a tier change; an Admin must approve it.
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
          <label className="grid gap-1">
            <div className="text-xs font-semibold text-zinc-200">New tier</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-white/30"
              value={newTier}
              onChange={(e) => setNewTier(e.target.value)}
            />
          </label>
          <div className="flex items-end">
            <button
              disabled={!canRequestTier}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white enabled:hover:bg-white/10 disabled:opacity-50"
              onClick={async () => {
                if (!value.invoiceRegistry || !address) return;
                const sim = await publicClient!.simulateContract({
                  address: value.invoiceRegistry,
                  abi: invoiceRegistryAbi,
                  functionName: "requestRiskTierMigration",
                  args: [BigInt(invoiceId || "0"), Number(newTier || "0")],
                  account: address,
                });
                const hash = await writeContractAsync(sim.request);
                setTierReqHash(hash);
              }}
            >
              Request
            </button>
          </div>
        </div>
        <TxStatus hash={tierReqHash} />
      </section>
    </PageShell>
  );
}

