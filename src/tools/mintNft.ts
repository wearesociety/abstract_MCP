import { z } from "zod";
import { FastMCP, UserError } from "fastmcp";
import { getWalletClient } from "../utils/viemClient.js";
import { resolveAddress } from "../utils/addressHelpers.js";

// Basic ERC721 mint function ABI (assumes `mint(address,uint256)` )
const ERC721_MINT_ABI = [
    {
        inputs: [
            { internalType: "address", name: "to", type: "address" },
            { internalType: "uint256", name: "tokenId", type: "uint256" },
        ],
        name: "mint",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
] as const;

const ParamsSchema = z.object({
    contractAddress: z.string().describe("ERC-721 contract address"),
    to: z.string().describe("Recipient address or ENS"),
    tokenId: z.string().optional().describe("Token ID (auto-increment if omitted)"),
});

type Params = z.infer<typeof ParamsSchema>;

export function registerMintNft(server: FastMCP) {
    server.addTool({
        name: "ab_mint_nft",
        description: `Mint a new ERC-721 token from an existing contract (must expose mint(address,uint256)).

DETAILS
• Auto-generates tokenId using epoch ms when not provided
• Supports ENS recipient resolution
• Returns tx hash for explorer linking

TYPICAL USES
• Distribute workshop attendance NFTs
• Internal test collections
• Rapid prototype of NFT gating flows`,
        parameters: ParamsSchema,
        annotations: { destructiveHint: true, title: "Mint NFT" },
        execute: async (args: Params, { log }) => {
            const recipient = await resolveAddress(args.to);
            if (!recipient) throw new UserError("Cannot resolve recipient address");

            const tokenId = args.tokenId ? BigInt(args.tokenId) : BigInt(Date.now());

            const wallet = getWalletClient();
            const account = wallet.account;
            if (!account) throw new UserError("Wallet account missing");

            log.info("Minting NFT", { contract: args.contractAddress, to: recipient, tokenId: tokenId.toString() });
            const hash = await wallet.writeContract({
                address: args.contractAddress as `0x${string}`,
                abi: ERC721_MINT_ABI,
                functionName: "mint",
                args: [recipient, tokenId],
                account,
                chain: wallet.chain,
            });
            log.info("NFT mint tx", { hash });
            return hash;
        },
    });
} 