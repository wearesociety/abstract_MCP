import { FastMCP } from "fastmcp";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – dotenv types resolution conflict under NodeNext; safe to ignore
import * as dotenv from "dotenv";
import { registerAbDeployToken } from "./tools/ab_deployToken.js";
import { registerGetBalance } from "./tools/ab_getBalance.js";
import { registerTransferToken } from "./tools/ab_transferToken.js";
import { registerAgwCreateWallet } from "./tools/ab_agwCreateWallet.js";
import { registerGenerateEoaWallet } from "./tools/ab_generateEoaWallet.js";
// import { registerMintNft } from "./tools/mintNft.js"; // Temporarily disabled
// import { registerBridgeNft } from "./tools/bridgeNft.js"; // Temporarily disabled

// Load .env file if it exists (optional for development)
try {
    dotenv.config();
} catch (error) {
    // .env file is optional - all required variables should come from client
    console.log("No .env file found or failed to load - using environment variables from client");
}

export const server = new FastMCP({ name: "Society Abstract MCP", version: "0.1.0" });

registerAbDeployToken(server); // Deploy MyContract using factory pattern
registerGetBalance(server);    // Get the balance of an address
registerTransferToken(server); // Transfer tokens to an address
registerAgwCreateWallet(server); // Deploy a new Abstract Global Wallet (smart-contract account) for a given signer
registerGenerateEoaWallet(server); // Generate a brand-new Externally Owned Account (EOA)
// registerMintNft(server); // Temporarily disabled
// registerBridgeNft(server); // Temporarily disabled

if (import.meta.url === `file://${process.argv[1]}`) {
    // Start as stdio server (best practice for FastMCP agents)
    await server.start();
} 