import { isAddress as _isAddress, namehash } from "viem";
import { getPublicClient } from "./viemClient.js";

/** Check if string is a checksum/hex address */
export function isAddress(value: string): boolean {
    return _isAddress(value);
}

/**
 * Resolve an ENS name or passthrough an address.
 * Returns undefined if resolution fails.
 */
export async function resolveAddress(value: string): Promise<`0x${string}` | undefined> {
    const client = getPublicClient();
    if (isAddress(value)) return value as `0x${string}`;
    try {
        const address = await client.getEnsAddress({ name: value });
        return address ?? undefined;
    } catch {
        return undefined;
    }
} 