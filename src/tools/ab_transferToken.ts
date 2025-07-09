import { z } from "zod";
import { FastMCP, UserError } from "fastmcp";
import { getWalletClient, getPublicClient } from "../utils/viemClient.js";
import { resolveAddress } from "../utils/addressHelpers.js";
import { getTokenBySymbol } from "../constants/tokens.js";
import { parseEther, parseUnits } from "viem";

const ERC20_ABI = [
    { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
    { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

const ParamsSchema = z
    .object({
        to: z.string().describe("Recipient address or ENS name"),
        amount: z.string().describe("Amount to transfer (human units)"),
        tokenAddress: z.string().optional(),
        tokenSymbol: z.string().optional(),
    })
    .refine((d) => !(d.tokenAddress && d.tokenSymbol), {
        message: "Provide either tokenAddress or tokenSymbol, not both",
    });

type Params = z.infer<typeof ParamsSchema>;

export function registerTransferToken(server: FastMCP) {
    server.addTool({
        name: "ab_transfer_token",
        description: `Transfer value from the caller’s wallet to another address.

FUNCTIONALITY
• Native ETH transfer (simple payment)
• ERC-20 transfer (requires tokenAddress or known tokenSymbol)
• ENS resolution for recipient

VALIDATION & LOGGING
• Ensures wallet signer configured, token decimals fetched automatically
• Logs tx hash on success so the agent can create explorer links

COMMON USE-CASES
• Payout scripted rewards
• Move workshop faucet tokens to students
• Automation flows needing programmatic payment`,
        parameters: ParamsSchema,
        annotations: { destructiveHint: true, title: "Transfer Token" },
        execute: async (args: Params, { log }) => {
            const recipient = await resolveAddress(args.to);
            if (!recipient) throw new UserError("Unable to resolve recipient");

            const wallet = getWalletClient();
            const account = wallet.account;
            if (!account) throw new UserError("Wallet account missing");

            // Determine token details
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
                // Native transfer
                const value = parseEther(args.amount);
                log.info("Sending native ETH", { to: recipient, value: args.amount });
                const hash = await wallet.sendTransaction({
                    to: recipient,
                    value,
                    account,
                    chain: wallet.chain,
                });
                log.info("Transaction sent", { hash });
                return hash;
            }

            // ERC20 transfer
            const client = getPublicClient();
            // Attempt to fetch decimals
            try {
                decimals = await client.readContract({
                    address: tokenAddress,
                    abi: ERC20_ABI,
                    functionName: "decimals",
                });
            } catch { }

            const amountParsed = parseUnits(args.amount, decimals);
            log.info("Sending ERC20", { tokenAddress, to: recipient, amount: args.amount });
            const hash = await wallet.writeContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: "transfer",
                args: [recipient, amountParsed],
                account,
                chain: wallet.chain,
            });
            log.info("ERC20 transfer tx", { hash });
            return hash;
        },
    });
} 