"use client";

import { useEffect, useMemo, useState } from "react";
import { useChainId } from "wagmi";
import { arbitrumSepolia, hardhat } from "wagmi/chains";

export type AddressBook = {
  noxCompute?: `0x${string}`;
  invoiceRegistry?: `0x${string}`;
  riskManager?: `0x${string}`;
  policyPack?: `0x${string}`;
  vault?: `0x${string}`;
  servicingRouter?: `0x${string}`;
  disclosureManager?: `0x${string}`;
  verifier?: `0x${string}`;
  cashToken?: `0x${string}`;
  wrapper?: `0x${string}`;
  usdc?: `0x${string}`;
};

type ChainKey = "hardhat" | "arbitrumSepolia";

function chainKey(chainId: number): ChainKey | null {
  if (chainId === hardhat.id) return "hardhat";
  if (chainId === arbitrumSepolia.id) return "arbitrumSepolia";
  return null;
}

const storageKey = (key: ChainKey) => `noxvault.addresses.${key}`;

export function useAddressBook() {
  const id = useChainId();
  const key = chainKey(id);
  const [override, setOverride] = useState<AddressBook | null>(null);

  useEffect(() => {
    if (!key) {
      setOverride(null);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey(key));
      setOverride(raw ? (JSON.parse(raw) as AddressBook) : null);
    } catch {
      setOverride(null);
    }
  }, [key]);

  const env = useMemo<AddressBook>(() => {
    const book: AddressBook = {
      noxCompute: process.env.NEXT_PUBLIC_NOX_COMPUTE_ADDRESS as `0x${string}` | undefined,
      invoiceRegistry: process.env.NEXT_PUBLIC_INVOICE_REGISTRY_ADDRESS as `0x${string}` | undefined,
      riskManager: process.env.NEXT_PUBLIC_RISK_MANAGER_ADDRESS as `0x${string}` | undefined,
      policyPack: process.env.NEXT_PUBLIC_POLICY_PACK_ADDRESS as `0x${string}` | undefined,
      vault: process.env.NEXT_PUBLIC_VAULT_ADDRESS as `0x${string}` | undefined,
      servicingRouter: process.env.NEXT_PUBLIC_SERVICING_ROUTER_ADDRESS as `0x${string}` | undefined,
      disclosureManager: process.env.NEXT_PUBLIC_DISCLOSURE_MANAGER_ADDRESS as `0x${string}` | undefined,
      verifier: process.env.NEXT_PUBLIC_VERIFIER_ADDRESS as `0x${string}` | undefined,
      cashToken: process.env.NEXT_PUBLIC_CASH_TOKEN_ADDRESS as `0x${string}` | undefined,
      wrapper: process.env.NEXT_PUBLIC_WRAPPER_ADDRESS as `0x${string}` | undefined,
      usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}` | undefined,
    };
    return book;
  }, []);

  const value = useMemo(() => {
    return { ...env, ...(override ?? {}) };
  }, [env, override]);

  function save(next: AddressBook) {
    if (!key) return;
    localStorage.setItem(storageKey(key), JSON.stringify(next));
    setOverride(next);
  }

  function clear() {
    if (!key) return;
    localStorage.removeItem(storageKey(key));
    setOverride(null);
  }

  return { chainId: id, supported: !!key, value, save, clear, override };
}

