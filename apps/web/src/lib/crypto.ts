import { encodePacked, keccak256, pad, toHex } from "viem";

export function uint256ToBytes32(value: bigint) {
  return pad(toHex(value), { size: 32 }) as `0x${string}`;
}

export function computePublicHandle(chainId: bigint, teeType: bigint, valueBytes32: `0x${string}`) {
  return keccak256(
    encodePacked(["uint256", "uint256", "bytes32", "bool"], [chainId, teeType, valueBytes32, true]),
  ) as `0x${string}`;
}

