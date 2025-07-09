import { z } from "zod";
import { FastMCP, UserError } from "fastmcp";
import { getWalletClient } from "../utils/viemClient.js";
import { resolveAddress } from "../utils/addressHelpers.js";

// Minimal ONFT sendFrom ABI (LayerZero)
const ONFT_ABI = [
    {
        inputs: [
            { name: "_from", type: "address" },
            { name: "_dstChainId", type: "uint16" },
            { name: "_toAddress", type: "bytes" },
            { name: "_tokenId", type: "uint256" },
            { name: "_refundAddress", type: "address" },
            { name: "_zroPaymentAddress", type: "address" },
            { name: "_adapterParams", type: "bytes" },
        ],
        name: "sendFrom",
        outputs: [],
        stateMutability: "payable",
        type: "function",
    },
] as const;

const ParamsSchema = z.object({
    srcContract: z.string().describe("ONFT contract address on source chain"),
    dstChainId: z.number().describe("Destination LayerZero chain ID"),
    tokenId: z.string().describe("Token ID to bridge"),
    to: z.string().optional().describe("Destination address (defaults to same as sender)"),
});

type Params = z.infer<typeof ParamsSchema>;

export function registerBridgeNft(server: FastMCP) {
    server.addTool({
        name: "ab_bridge_nft",
        description: `Bridge an existing ONFT (LayerZero-enabled NFT) from the current Abstract chain to another L0 chain ID.

FEATURES
• Uses sendFrom – will move token ID cross-chain
• Destination address defaults to sender but can be overridden / ENS
• Requires user to have prepaid fees on source chain (value=0 by default)

COMMON SCENARIOS
• Cross-chain game asset migration
• Demonstrations of ONFT technology in workshops
• Moving NFTs from testnet to mainnet collections`,
        parameters: ParamsSchema,
        annotations: { destructiveHint: true, title: "Bridge NFT" },
        execute: async (args: Params, { log }) => {
            const wallet = getWalletClient();
            const account = wallet.account;
            if (!account) throw new UserError("Wallet account missing");

            const toAddr = args.to ? await resolveAddress(args.to) : account.address;
            if (!toAddr) throw new UserError("Unable to resolve destination address");

            const dstBytes = toAddr.toLowerCase().replace("0x", "");
            const dstBytesPacked = `0x${dstBytes}` as `0x${string}`;

            const value = BigInt(0); // Assume prepaid fees externally

            log.info("Bridging NFT", { tokenId: args.tokenId, dstChain: args.dstChainId });
            const hash = await wallet.writeContract({
                address: args.srcContract as `0x${string}`,
                abi: ONFT_ABI,
                functionName: "sendFrom",
                args: [account.address, args.dstChainId, dstBytesPacked, BigInt(args.tokenId), account.address, "0x0000000000000000000000000000000000000000", "0x"],
                value,
                account,
                chain: wallet.chain,
            });
            log.info("Bridge tx", { hash });
            return hash;
        },
    });
} 