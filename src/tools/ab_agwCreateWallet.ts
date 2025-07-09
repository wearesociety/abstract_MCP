import { z } from "zod";
import { FastMCP, UserError } from "fastmcp";
import { deployAccount } from "@abstract-foundation/agw-client/actions";
import { getWalletClient, getPublicClient } from "../utils/viemClient.js";
import { resolveAddress } from "../utils/addressHelpers.js";

const ParamsSchema = z.object({
    signer: z
        .string()
        .optional()
        .describe(
            "EOA signer address or ENS. If omitted, uses the server wallet’s account as the initial signer",
        ),
});

export type AgwCreateWalletParams = z.infer<typeof ParamsSchema>;

export function registerAgwCreateWallet(server: FastMCP) {
    server.addTool({
        name: "ab_agw_create_wallet",
        description: `Deploy a new Abstract Global Wallet (smart-contract account) for a given signer.

The tool wraps @abstract-foundation/agw-client’s \`deployAccount\` helper.

Returns both the smart-account address and the deployment tx hash (\`undefined\` when the account already exists).`,
        parameters: ParamsSchema,
        annotations: { destructiveHint: true, title: "AGW • Deploy Smart Account" },
        execute: async (args: AgwCreateWalletParams, { log }) => {
            const walletClient = getWalletClient() as any; // viem WalletClient
            const publicClient = getPublicClient() as any; // viem PublicClient

            // Resolve signer if provided
            let signerAddress: `0x${string}` | undefined = undefined;
            if (args.signer) {
                const resolved = await resolveAddress(args.signer);
                if (!resolved) throw new UserError("Unable to resolve signer address");
                signerAddress = resolved;
            }

            log.info("Deploying AGW smart account", { signerAddress: signerAddress ?? walletClient.account.address });
            const { smartAccountAddress } = await deployAccount({
                walletClient,
                publicClient,
                initialSignerAddress: signerAddress,
            });
            return smartAccountAddress;
        },
    });
} 