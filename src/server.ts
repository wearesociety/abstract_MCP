import { FastMCP } from "fastmcp";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – dotenv types resolution conflict under NodeNext; safe to ignore
import * as dotenv from "dotenv";
import { registerAbDeployToken } from "./tools/ab_deployToken.js";
import { registerGetBalance } from "./tools/ab_getBalance.js";
import { registerTransferToken } from "./tools/ab_transferToken.js";
// import { registerMintNft } from "./tools/mintNft.js"; // Temporarily disabled
// import { registerBridgeNft } from "./tools/bridgeNft.js"; // Temporarily disabled
import { registerAgwCreateWallet } from "./tools/ab_agwCreateWallet.js";
import { registerGenerateEoaWallet } from "./tools/ab_generateEoaWallet.js";

dotenv.config();

export const server = new FastMCP({ name: "Society Abstract MCP", version: "0.1.0" });

// TODO: import and register tools once implemented
//registerDeployToken(server); // Deploy MyContract using factory pattern
registerAbDeployToken(server); // Deploy MyContract using factory pattern
registerGetBalance(server);
registerTransferToken(server);
// registerMintNft(server); // Temporarily disabled
// registerBridgeNft(server); // Temporarily disabled
registerAgwCreateWallet(server);
registerGenerateEoaWallet(server);

if (import.meta.url === `file://${process.argv[1]}`) {
    // Start as stdio server (best practice for FastMCP agents)
    // eslint-disable-next-line no-console
    //console.log("🚀 Society Abstract MCP starting (stdio mode)");
    await server.start();
} 