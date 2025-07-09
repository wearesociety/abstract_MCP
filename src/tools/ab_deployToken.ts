import { z } from "zod";
import { FastMCP, UserError, type ContentResult } from "fastmcp";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

// ESM-compatible __dirname replacement
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ParamsSchema = z.object({
    name: z.string().describe("Token name"),
    symbol: z.string().describe("Token symbol / ticker"),
    initialSupply: z
        .string()
        .regex(/^\d+$/, {
            message: "initialSupply must be a numeric string representing the amount in wei (18 decimals)",
        })
        .describe("Initial token supply, in wei (e.g. 1000000000000000000000 for 1000 tokens)"),
    debug: z.boolean().optional().describe("Return verbose error information instead of throwing"),
});

export type Params = z.infer<typeof ParamsSchema>;

/**
 * Load BasicToken contract artifacts from the compiled contracts directory
 * @param log - Logger instance for debugging
 * @returns Contract ABI and bytecode
 */
async function loadBasicTokenArtifacts(log: any): Promise<{ abi: any; bytecode: `0x${string}` }> {
    const projectRoot = path.resolve(__dirname, "..", "..");
    
    // Try multiple candidate paths for the BasicToken artifact
    const candidatePaths = [
        // From dist/tools (compiled) - artifacts are in src/contracts
        path.join(__dirname, "../src/contracts/artifacts-zk/contracts/BasicToken.sol/BasicToken.json"),
        // From src/tools (development) - direct path
        path.join(projectRoot, "src/contracts/artifacts-zk/contracts/BasicToken.sol/BasicToken.json"),
        // Alternative relative path from project root
        path.join(__dirname, "../../src/contracts/artifacts-zk/contracts/BasicToken.sol/BasicToken.json"),
    ];

    log.info("Attempting to load BasicToken artifacts");

    for (const artifactPath of candidatePaths) {
        try {
            if (fs.existsSync(artifactPath)) {
                log.info(`Found BasicToken artifact at ${artifactPath}`);
                const artifactJson = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
                
                if (!artifactJson.abi || !artifactJson.bytecode) {
                    throw new Error("Invalid artifact: missing ABI or bytecode");
                }
                
                log.info("Successfully loaded BasicToken artifacts");
                
                return {
                    abi: artifactJson.abi,
                    bytecode: artifactJson.bytecode as `0x${string}`,
                };
            }
        } catch (error) {
            log.warn(`Failed to load artifact from path ${artifactPath}: ${(error as Error).message}`);
        }
    }

    throw new Error(`BasicToken artifact not found in any of the candidate paths: ${candidatePaths.join(", ")}`);
}

/**
 * Validate environment variables required for deployment
 * @param log - Logger instance
 * @returns Validated environment configuration
 */
function validateEnvironment(log: any): { rpcUrl: string; privateKey: string } {
    const rpcUrl = process.env.ABSTRACT_RPC_URL || process.env.RPC_URL;
    const privateKey = process.env.ABSTRACT_PRIVATE_KEY || process.env.PRIVATE_KEY;

    log.info("Validating environment variables");

    if (!rpcUrl) {
        throw new UserError("RPC_URL or ABSTRACT_RPC_URL environment variable is required");
    }

    if (!privateKey) {
        throw new UserError("PRIVATE_KEY or ABSTRACT_PRIVATE_KEY environment variable is required");
    }

    // Basic validation of private key format
    if (!privateKey.startsWith("0x") || privateKey.length !== 66) {
        throw new UserError("Invalid private key format. Must be 64 hex characters prefixed with 0x");
    }

    return { rpcUrl, privateKey };
}

/**
 * Deploy BasicToken contract using zksync-ethers in a subprocess to avoid ESM issues
 * @param name - Token name
 * @param symbol - Token symbol
 * @param initialSupply - Initial supply in wei
 * @param log - Logger instance
 * @returns Deployed contract address
 */
async function deployBasicToken(
    name: string,
    symbol: string,
    initialSupply: string,
    log: any
): Promise<string> {
    log.info(`Starting BasicToken deployment: ${name} (${symbol})`);

    // Validate environment
    const { rpcUrl, privateKey } = validateEnvironment(log);

    // Use the working standalone script approach but properly integrated
    const { execFile } = await import("child_process");
    
    // Path resolution for the deployment script
    // In production: everything is bundled into dist/server.js, so __dirname = dist/
    // In development: __dirname = src/tools/, but we need to find the actual script location
    
    // Try multiple path resolutions to handle both scenarios
    const possiblePaths = [
        // Production: from dist/server.js to dist/constants/
        path.resolve(__dirname, "constants/deployBasicToken.js"),
        // Development fallback: from src/tools to src/constants  
        path.resolve(__dirname, "../constants/deployBasicToken.js"),
        // Alternative: relative to project root
        path.resolve(process.cwd(), "dist/constants/deployBasicToken.js"),
        path.resolve(process.cwd(), "src/constants/deployBasicToken.js")
    ];
    
    let scriptPath: string | null = null;
    for (const candidatePath of possiblePaths) {
        if (fs.existsSync(candidatePath)) {
            scriptPath = candidatePath;
            break;
        }
    }
    
    if (!scriptPath) {
        const pathList = possiblePaths.map(p => `  - ${p}`).join('\n');
        throw new Error(`deployBasicToken.js script not found in any expected location:\n${pathList}\nMake sure to run 'npm run build' to copy the script.`);
    }
    
    log.info(`Using script path: ${scriptPath}`);
    log.info(`Current __dirname: ${__dirname}`);
    log.info(`Resolved script exists: ${fs.existsSync(scriptPath)}`);

    log.info("Deploying using standalone script");

    const result = await new Promise<{ stdout: string; stderr: string; code: number }>((resolve) => {
        execFile(
            "node",
            [scriptPath],
            {
                env: {
                    ...process.env,
                    ABSTRACT_RPC_URL: rpcUrl,
                    ABSTRACT_PRIVATE_KEY: privateKey,
                    TOKEN_NAME: name,
                    TOKEN_SYMBOL: symbol,
                    TOKEN_SUPPLY: initialSupply,
                },
                                 cwd: process.cwd(),
                maxBuffer: 1024 * 1024 * 10, // 10MB
            },
            (error, stdout, stderr) => {
                let code = 0;
                if (error) {
                    if (typeof (error as any).code === "number") code = (error as any).code;
                    else code = 1;
                }
                resolve({
                    stdout,
                    stderr,
                    code,
                });
            }
        );
    });

    if (result.code !== 0) {
        const errorMsg = result.stderr.trim() || result.stdout.trim() || "Deployment failed";
        log.error(`Token deployment failed: ${errorMsg}`);
        throw new UserError(errorMsg);
    }

    // Parse the console output to extract address
    const output = result.stdout;
    const contractMatch = output.match(/BasicToken deployed at:\s*(0x[a-fA-F0-9]+)/i);

    if (!contractMatch) {
        throw new Error("Failed to parse deployed token address from output");
    }

    const contractAddress = contractMatch[1];
    log.info(`BasicToken deployed successfully at: ${contractAddress}`);

    return contractAddress;
}

/**
 * Register the ab_deploy_token_erc20 tool with FastMCP.
 * Deploys BasicToken ERC-20 contracts using the proven zksync-ethers method.
 */
export function registerAbDeployToken(server: FastMCP) {
    server.addTool({
        name: "ab_deploy_token_erc20",
        description: `Deploy an ERC-20 BasicToken to the Abstract network.

PARAMETERS
- name – token name (e.g. "DemoToken")
- symbol – token symbol/ticker (e.g. "DMT")
- initialSupply – numeric string of total supply in wei (18 decimals)

FLOW
- Uses proven zksync-ethers deployment method via subprocess
- Returns the deployed contract address

SECURITY / LIMITATIONS
- Make sure the deployer wallet (PRIVATE_KEY / ABSTRACT_PRIVATE_KEY) has enough funds on the target network`,
        parameters: ParamsSchema,
        annotations: { destructiveHint: true, title: "Contract Deployment Tool" },
        execute: deployTokenToolExecute,
    });
}

async function deployTokenToolExecute(args: Params, { log }: { log: any }): Promise<ContentResult> {
    log.info(`Starting ERC-20 token deployment via MCP: ${args.name} (${args.symbol})`);

    try {
        // Deploy the token
        const contractAddress = await deployBasicToken(
            args.name,
            args.symbol,
            args.initialSupply,
            log
        );

        // Calculate human-readable supply (assuming 18 decimals)
        const humanSupply = (BigInt(args.initialSupply) / BigInt(10**18)).toString();

        log.info(`Token deployment completed successfully: ${contractAddress}`);

        return {
            content: [
                {
                    type: "text" as const,
                    text: `ERC-20 Token Deployed Successfully!

**Contract Details:**
- **Address:** ${contractAddress}
- **Name:** ${args.name}
- **Symbol:** ${args.symbol}
- **Total Supply:** ${humanSupply} ${args.symbol}
- **Initial Supply (wei):** ${args.initialSupply}

**Next Steps:**
- Verify contract on Abstract explorer
- Add token to wallets using contract address
- Test token transfers and functionality

**Technical Details:**
- Network: Abstract
- Standard: ERC-20
- Decimals: 18`,
                },
            ],
        };
    } catch (error: any) {
        log.error(`Token deployment failed: ${error.message}`);

        // Provide specific error messages for common issues
        let errorMessage = error.message;
        if (error.message.includes("insufficient funds")) {
            errorMessage = "Insufficient funds in wallet for deployment. Please fund your wallet and try again.";
        } else if (error.message.includes("network")) {
            errorMessage = "Network connection issue. Please check your RPC URL and try again.";
        } else if (error.message.includes("private key")) {
            errorMessage = "Invalid private key. Please check your ABSTRACT_PRIVATE_KEY environment variable.";
        }

        throw new UserError(errorMessage);
    }
} 