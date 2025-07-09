import { z } from "zod";
import { FastMCP, UserError } from "fastmcp";
import { getPublicClient } from "../utils/viemClient.js";
import { resolveAddress } from "../utils/addressHelpers.js";
import { getTokenBySymbol } from "../constants/tokens.js";
import { formatEther } from "viem";

// Minimal ERC-20 ABI fragment
const ERC20_ABI = [
    { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
    { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

const ParamsSchema = z
    .object({
        address: z.string().describe("Target wallet (address or ENS) to query"),
        tokenAddress: z.string().optional().describe("ERC-20 token address"),
        tokenSymbol: z.string().optional().describe("Token symbol to resolve (e.g. USDC)")
    })
    .refine((data) => !(data.tokenAddress && data.tokenSymbol), {
        message: "Provide either tokenAddress or tokenSymbol, not both",
    });

type Params = z.infer<typeof ParamsSchema>;

export function registerGetBalance(server: FastMCP) {
    server.addTool({
        name: "ab_get_balance",
        description: `Fetch the current on-chain balance for a wallet.

CAPABILITIES
• Native ETH balance (default)
• ERC-20 balance via tokenAddress OR well-known tokenSymbol (lookup table)
• ENS name resolution for the target address

EXAMPLES
1. Native balance → { address: "vitalik.eth" }
2. ERC-20 balance via symbol → { address: "0x123…", tokenSymbol: "USDC" }
3. ERC-20 via contract → { address: "0xabc…", tokenAddress: "0xA0b8…" }

RETURNS
• Human-readable string (e.g. "12.3456")

SECURITY
• Read-only operation, no gas spent; safe to run frequently.`,
        parameters: ParamsSchema,
        annotations: { readOnlyHint: true, title: "Get Balance" },
        execute: async (args: Params, { log }) => {
            log.info("Resolving address", { address: args.address });
            const target = await resolveAddress(args.address);
            if (!target) throw new UserError("Unable to resolve address");

            const client = getPublicClient();

            // Determine token context
            let tokenAddress: `0x${string}` | undefined;
            let decimals = 18;
            if (args.tokenAddress || args.tokenSymbol) {
                if (args.tokenAddress) {
                    tokenAddress = args.tokenAddress as `0x${string}`;
                } else if (args.tokenSymbol) {
                    const t = getTokenBySymbol(args.tokenSymbol);
                    if (!t) throw new UserError(`Unknown token symbol ${args.tokenSymbol}`);
                    tokenAddress = t.address;
                    decimals = t.decimals;
                }
            }

            if (!tokenAddress) {
                // Native balance
                const balance = await client.getBalance({ address: target });
                const formatted = formatEther(balance);
                log.info("Retrieved native balance", { balance: formatted });
                return formatted;
            }

            // ERC-20 balance
            log.info("Fetching ERC20 balance", { tokenAddress });
            // Fetch decimals dynamically
            try {
                decimals = await client.readContract({
                    address: tokenAddress,
                    abi: ERC20_ABI,
                    functionName: "decimals",
                });
            } catch {
                // ignore if fails – fallback
            }

            const balanceRaw: bigint = await client.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: "balanceOf",
                args: [target],
            });
            const formatted = Number(balanceRaw) / 10 ** decimals;
            log.info("ERC20 balance", { formatted });
            return formatted.toString();
        },
    });
} 