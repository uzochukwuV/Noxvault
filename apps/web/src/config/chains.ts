import { arbitrumSepolia, hardhat } from "wagmi/chains";

export const supportedChains = [hardhat, arbitrumSepolia] as const;

export function explorerTxUrl(chainId: number, hash: `0x${string}`) {
  if (chainId === arbitrumSepolia.id) return `https://sepolia.arbiscan.io/tx/${hash}`;
  if (chainId === hardhat.id) return `http://127.0.0.1:8545/tx/${hash}`;
  return "";
}

