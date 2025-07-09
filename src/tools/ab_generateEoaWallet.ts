import { FastMCP } from "fastmcp";
import { randomBytes } from "crypto";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

// No params needed, but FastMCP requires a schema
const EmptySchema = z.object({}).describe("No parameters required");

type Params = z.infer<typeof EmptySchema>;

export function registerGenerateEoaWallet(server: FastMCP) {
    server.addTool({
        name: "ab_generate_wallet",
        description: `Generate a brand-new Externally Owned Account (EOA).

RETURNS
• privateKey – 0x-prefixed 32-byte hex string
• address – checksummed Ethereum/Abstract address

COMMON USES
• Let agents spin up their own keypairs before funding or deploying smart-accounts.

SECURITY
• The private key is returned in plaintext. Ensure the caller stores it securely and never logs it.`,
        parameters: EmptySchema,
        annotations: { destructiveHint: false, title: "Generate EOA Wallet" },
        execute: async (_args: Params, _ctx) => {
            // Generate 32 random bytes
            const pkBytes = randomBytes(32);
            const privateKey = `0x${pkBytes.toString("hex")}` as `0x${string}`;
            const account = privateKeyToAccount(privateKey);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ privateKey, address: account.address }),
                    },
                ],
            };
        },
    });
} 