import { ContractFactory, Provider, Wallet } from "zksync-ethers";
import dotenv from "dotenv/config";
import fs from "fs";
import path from "path";

// Load artifact for BasicToken (ABI + bytecode)
// Try both local (src/constants) and build (dist/constants) paths
let artifactJson;
const scriptDir = path.dirname(new URL(import.meta.url).pathname);

// Path options: local development vs built distribution
const artifactPaths = [
    // For src/constants/ location
    path.resolve(scriptDir, "../contracts/artifacts-zk/contracts/BasicToken.sol/BasicToken.json"),
    // For dist/constants/ location  
    path.resolve(scriptDir, "../../src/contracts/artifacts-zk/contracts/BasicToken.sol/BasicToken.json")
];

for (const artifactPath of artifactPaths) {
    try {
        if (fs.existsSync(artifactPath)) {
            artifactJson = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
            console.log(`✅ Loaded artifact from: ${artifactPath}`);
            break;
        }
    } catch (err) {
        console.log(`⚠️ Failed to load artifact from: ${artifactPath}`);
        continue;
    }
}

if (!artifactJson) {
    console.error("❌ Could not find BasicToken artifact in any of the expected paths:");
    artifactPaths.forEach(p => console.error(`   - ${p}`));
    process.exit(1);
}

const BASIC_TOKEN_ABI = artifactJson.abi;
const BASIC_TOKEN_BYTECODE = artifactJson.bytecode;

// Environment variables
const RPC_URL = process.env.RPC_URL || process.env.ABSTRACT_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.ABSTRACT_PRIVATE_KEY;
const TOKEN_NAME = process.env.TOKEN_NAME || "DemoToken";
const TOKEN_SYMBOL = process.env.TOKEN_SYMBOL || "DMT";
const INITIAL_SUPPLY = process.env.TOKEN_SUPPLY || "1000000000000000000000"; // 1000 tokens (18 decimals)

if (!RPC_URL) {
    console.error("❌ RPC_URL (or ABSTRACT_RPC_URL) not set in environment variables");
    process.exit(1);
}
if (!PRIVATE_KEY) {
    console.error("❌ PRIVATE_KEY (or ABSTRACT_PRIVATE_KEY) not set in environment variables");
    process.exit(1);
}

const provider = new Provider(RPC_URL);
const wallet = new Wallet(PRIVATE_KEY, provider);

async function main() {
    console.log(`🚀 Deploying token ${TOKEN_NAME} (${TOKEN_SYMBOL}) with initial supply ${INITIAL_SUPPLY}`);
    const factory = new ContractFactory(BASIC_TOKEN_ABI, BASIC_TOKEN_BYTECODE, wallet);
    const token = await factory.deploy(TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY);
    console.log("⏳ Waiting for deployment to be mined...");
    await token.deployed?.(); // zksync-ethers may not have deployed, fallback below
    const addr = token.getAddress ? await token.getAddress() : token.address;
    console.log("✅ BasicToken deployed at:", addr);
}

main().catch((err) => {
    console.error("Deployment failed:", err);
    process.exit(1);
}); 