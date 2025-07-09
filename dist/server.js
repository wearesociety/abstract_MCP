// src/server.ts
import { FastMCP as FastMCP6 } from "fastmcp";
import * as dotenv2 from "dotenv";

// src/tools/ab_deployToken.ts
import { z } from "zod";
import { UserError } from "fastmcp";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var ParamsSchema = z.object({
  name: z.string().describe("Token name"),
  symbol: z.string().describe("Token symbol / ticker"),
  initialSupply: z.string().regex(/^\d+$/, {
    message: "initialSupply must be a numeric string representing the amount in wei (18 decimals)"
  }).describe("Initial token supply, in wei (e.g. 1000000000000000000000 for 1000 tokens)"),
  debug: z.boolean().optional().describe("Return verbose error information instead of throwing")
});
function validateEnvironment(log) {
  const rpcUrl = process.env.ABSTRACT_RPC_URL || process.env.RPC_URL;
  const privateKey = process.env.ABSTRACT_PRIVATE_KEY || process.env.PRIVATE_KEY;
  log.info("Validating environment variables");
  if (!rpcUrl) {
    throw new UserError("ABSTRACT_RPC_URL or RPC_URL environment variable is required");
  }
  if (!privateKey) {
    throw new UserError("ABSTRACT_PRIVATE_KEY or PRIVATE_KEY environment variable is required");
  }
  if (!privateKey.startsWith("0x") || privateKey.length !== 66) {
    throw new UserError("Invalid private key format. Must be 64 hex characters prefixed with 0x");
  }
  return { rpcUrl, privateKey };
}
async function deployBasicToken(name, symbol, initialSupply, log) {
  log.info(`Starting BasicToken deployment: ${name} (${symbol})`);
  const { rpcUrl, privateKey } = validateEnvironment(log);
  const { execFile } = await import("child_process");
  const possiblePaths = [
    // Production: from dist/server.js to dist/constants/
    path.resolve(__dirname, "constants/deployBasicToken.js"),
    // Development fallback: from src/tools to src/constants  
    path.resolve(__dirname, "../constants/deployBasicToken.js"),
    // Alternative: relative to project root
    path.resolve(process.cwd(), "dist/constants/deployBasicToken.js"),
    path.resolve(process.cwd(), "src/constants/deployBasicToken.js")
  ];
  let scriptPath = null;
  for (const candidatePath of possiblePaths) {
    if (fs.existsSync(candidatePath)) {
      scriptPath = candidatePath;
      break;
    }
  }
  if (!scriptPath) {
    const pathList = possiblePaths.map((p) => `  - ${p}`).join("\n");
    throw new Error(`deployBasicToken.js script not found in any expected location:
${pathList}
Make sure to run 'npm run build' to copy the script.`);
  }
  log.info(`Using script path: ${scriptPath}`);
  log.info(`Current __dirname: ${__dirname}`);
  log.info(`Resolved script exists: ${fs.existsSync(scriptPath)}`);
  log.info("Deploying using standalone script");
  const result = await new Promise((resolve) => {
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
          TOKEN_SUPPLY: initialSupply
        },
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024 * 10
        // 10MB
      },
      (error, stdout, stderr) => {
        let code = 0;
        if (error) {
          if (typeof error.code === "number")
            code = error.code;
          else
            code = 1;
        }
        resolve({
          stdout,
          stderr,
          code
        });
      }
    );
  });
  if (result.code !== 0) {
    const errorMsg = result.stderr.trim() || result.stdout.trim() || "Deployment failed";
    log.error(`Token deployment failed: ${errorMsg}`);
    throw new UserError(errorMsg);
  }
  const output = result.stdout;
  const contractMatch = output.match(/BasicToken deployed at:\s*(0x[a-fA-F0-9]+)/i);
  if (!contractMatch) {
    throw new Error("Failed to parse deployed token address from output");
  }
  const contractAddress = contractMatch[1];
  log.info(`BasicToken deployed successfully at: ${contractAddress}`);
  return contractAddress;
}
function registerAbDeployToken(server2) {
  server2.addTool({
    name: "ab_deploy_token_erc20",
    description: `Deploy an ERC-20 BasicToken to the Abstract network.

PARAMETERS
- name \u2013 token name (e.g. "DemoToken")
- symbol \u2013 token symbol/ticker (e.g. "DMT")
- initialSupply \u2013 numeric string of total supply in wei (18 decimals)

FLOW
- Uses proven zksync-ethers deployment method via subprocess
- Returns the deployed contract address

SECURITY / LIMITATIONS
- Make sure the deployer wallet (ABSTRACT_PRIVATE_KEY / PRIVATE_KEY) has enough funds on the target network`,
    parameters: ParamsSchema,
    annotations: { destructiveHint: true, title: "Contract Deployment Tool" },
    execute: deployTokenToolExecute
  });
}
async function deployTokenToolExecute(args, { log }) {
  log.info(`Starting ERC-20 token deployment via MCP: ${args.name} (${args.symbol})`);
  try {
    const contractAddress = await deployBasicToken(
      args.name,
      args.symbol,
      args.initialSupply,
      log
    );
    const humanSupply = (BigInt(args.initialSupply) / BigInt(10 ** 18)).toString();
    log.info(`Token deployment completed successfully: ${contractAddress}`);
    return {
      content: [
        {
          type: "text",
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
- Decimals: 18`
        }
      ]
    };
  } catch (error) {
    log.error(`Token deployment failed: ${error.message}`);
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

// src/tools/ab_getBalance.ts
import { z as z2 } from "zod";
import { UserError as UserError2 } from "fastmcp";

// src/utils/viemClient.ts
import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import dotenv from "dotenv";
try {
  dotenv.config();
} catch (error) {
}
var abstractTestnet = defineChain({
  id: 11124,
  name: "Abstract Testnet",
  network: "abstract-testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.ABSTRACT_RPC_URL ?? "https://api.testnet.abs.xyz"]
    },
    public: {
      http: [process.env.ABSTRACT_RPC_URL ?? "https://api.testnet.abs.xyz"]
    }
  }
});
var abstractMainnet = defineChain({
  id: 2741,
  name: "Abstract Mainnet",
  network: "abstract-mainnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.ABSTRACT_RPC_URL ?? "https://api.mainnet.abs.xyz/"]
    },
    public: {
      http: [process.env.ABSTRACT_RPC_URL ?? "https://api.mainnet.abs.xyz/"]
    }
  }
});
function getChain() {
  const target = (process.env.TESTNET ?? "true").toLowerCase() === "true" ? "testnet" : "mainnet";
  return target === "mainnet" ? abstractMainnet : abstractTestnet;
}
var _publicClient;
var _walletClient;
function getPublicClient() {
  if (!_publicClient) {
    const chain = getChain();
    _publicClient = createPublicClient({
      chain,
      transport: http(chain.rpcUrls.default.http[0])
    });
  }
  return _publicClient;
}
function getWalletClient() {
  if (!_walletClient) {
    let pk = process.env.ABSTRACT_PRIVATE_KEY ?? process.env.PRIVATE_KEY;
    if (!pk) {
      throw new Error("ABSTRACT_PRIVATE_KEY env variable is required");
    }
    if (!pk.startsWith("0x")) {
      pk = `0x${pk}`;
    }
    const account = privateKeyToAccount(pk);
    const chain = getChain();
    _walletClient = createWalletClient({
      chain,
      transport: http(chain.rpcUrls.default.http[0]),
      account
    });
  }
  return _walletClient;
}

// src/utils/addressHelpers.ts
import { isAddress as _isAddress } from "viem";
function isAddress(value) {
  return _isAddress(value);
}
async function resolveAddress(value) {
  const client = getPublicClient();
  if (isAddress(value))
    return value;
  try {
    const address = await client.getEnsAddress({ name: value });
    return address ?? void 0;
  } catch {
    return void 0;
  }
}

// src/constants/tokens.ts
var TOKENS = [
  {
    symbol: "ETH",
    address: "0x0000000000000000000000000000000000000000",
    decimals: 18
  }
  // Add more known tokens here
];
function getTokenBySymbol(symbol) {
  return TOKENS.find((t) => t.symbol.toLowerCase() === symbol.toLowerCase());
}

// src/tools/ab_getBalance.ts
import { formatEther } from "viem";
var ERC20_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }] }
];
var ParamsSchema2 = z2.object({
  address: z2.string().describe("Target wallet (address or ENS) to query"),
  tokenAddress: z2.string().optional().describe("ERC-20 token address"),
  tokenSymbol: z2.string().optional().describe("Token symbol to resolve (e.g. USDC)")
}).refine((data) => !(data.tokenAddress && data.tokenSymbol), {
  message: "Provide either tokenAddress or tokenSymbol, not both"
});
function registerGetBalance(server2) {
  server2.addTool({
    name: "ab_get_balance",
    description: `Fetch the current on-chain balance for a wallet.

CAPABILITIES
\u2022 Native ETH balance (default)
\u2022 ERC-20 balance via tokenAddress OR well-known tokenSymbol (lookup table)
\u2022 ENS name resolution for the target address

EXAMPLES
1. Native balance \u2192 { address: "vitalik.eth" }
2. ERC-20 balance via symbol \u2192 { address: "0x123\u2026", tokenSymbol: "USDC" }
3. ERC-20 via contract \u2192 { address: "0xabc\u2026", tokenAddress: "0xA0b8\u2026" }

RETURNS
\u2022 Human-readable string (e.g. "12.3456")

SECURITY
\u2022 Read-only operation, no gas spent; safe to run frequently.`,
    parameters: ParamsSchema2,
    annotations: { readOnlyHint: true, title: "Get Balance" },
    execute: async (args, { log }) => {
      log.info("Resolving address", { address: args.address });
      const target = await resolveAddress(args.address);
      if (!target)
        throw new UserError2("Unable to resolve address");
      const client = getPublicClient();
      let tokenAddress;
      let decimals = 18;
      if (args.tokenAddress || args.tokenSymbol) {
        if (args.tokenAddress) {
          tokenAddress = args.tokenAddress;
        } else if (args.tokenSymbol) {
          const t = getTokenBySymbol(args.tokenSymbol);
          if (!t)
            throw new UserError2(`Unknown token symbol ${args.tokenSymbol}`);
          tokenAddress = t.address;
          decimals = t.decimals;
        }
      }
      if (!tokenAddress) {
        const balance = await client.getBalance({ address: target });
        const formatted2 = formatEther(balance);
        log.info("Retrieved native balance", { balance: formatted2 });
        return formatted2;
      }
      log.info("Fetching ERC20 balance", { tokenAddress });
      try {
        decimals = await client.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "decimals"
        });
      } catch {
      }
      const balanceRaw = await client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [target]
      });
      const formatted = Number(balanceRaw) / 10 ** decimals;
      log.info("ERC20 balance", { formatted });
      return formatted.toString();
    }
  });
}

// src/tools/ab_transferToken.ts
import { z as z3 } from "zod";
import { UserError as UserError3 } from "fastmcp";
import { parseEther, parseUnits } from "viem";
var ERC20_ABI2 = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }
];
var ParamsSchema3 = z3.object({
  to: z3.string().describe("Recipient address or ENS name"),
  amount: z3.string().describe("Amount to transfer (human units)"),
  tokenAddress: z3.string().optional(),
  tokenSymbol: z3.string().optional()
}).refine((d) => !(d.tokenAddress && d.tokenSymbol), {
  message: "Provide either tokenAddress or tokenSymbol, not both"
});
function registerTransferToken(server2) {
  server2.addTool({
    name: "ab_transfer_token",
    description: `Transfer value from the caller\u2019s wallet to another address.

FUNCTIONALITY
\u2022 Native ETH transfer (simple payment)
\u2022 ERC-20 transfer (requires tokenAddress or known tokenSymbol)
\u2022 ENS resolution for recipient

VALIDATION & LOGGING
\u2022 Ensures wallet signer configured, token decimals fetched automatically
\u2022 Logs tx hash on success so the agent can create explorer links

COMMON USE-CASES
\u2022 Payout scripted rewards
\u2022 Move workshop faucet tokens to students
\u2022 Automation flows needing programmatic payment`,
    parameters: ParamsSchema3,
    annotations: { destructiveHint: true, title: "Transfer Token" },
    execute: async (args, { log }) => {
      const recipient = await resolveAddress(args.to);
      if (!recipient)
        throw new UserError3("Unable to resolve recipient");
      const wallet = getWalletClient();
      const account = wallet.account;
      if (!account)
        throw new UserError3("Wallet account missing");
      let tokenAddress;
      let decimals = 18;
      if (args.tokenAddress || args.tokenSymbol) {
        if (args.tokenAddress) {
          tokenAddress = args.tokenAddress;
        } else if (args.tokenSymbol) {
          const t = getTokenBySymbol(args.tokenSymbol);
          if (!t)
            throw new UserError3(`Unknown token symbol ${args.tokenSymbol}`);
          tokenAddress = t.address;
          decimals = t.decimals;
        }
      }
      if (!tokenAddress) {
        const value = parseEther(args.amount);
        log.info("Sending native ETH", { to: recipient, value: args.amount });
        const hash2 = await wallet.sendTransaction({
          to: recipient,
          value,
          account,
          chain: wallet.chain
        });
        log.info("Transaction sent", { hash: hash2 });
        return hash2;
      }
      const client = getPublicClient();
      try {
        decimals = await client.readContract({
          address: tokenAddress,
          abi: ERC20_ABI2,
          functionName: "decimals"
        });
      } catch {
      }
      const amountParsed = parseUnits(args.amount, decimals);
      log.info("Sending ERC20", { tokenAddress, to: recipient, amount: args.amount });
      const hash = await wallet.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI2,
        functionName: "transfer",
        args: [recipient, amountParsed],
        account,
        chain: wallet.chain
      });
      log.info("ERC20 transfer tx", { hash });
      return hash;
    }
  });
}

// src/tools/ab_agwCreateWallet.ts
import { z as z4 } from "zod";
import { UserError as UserError4 } from "fastmcp";

// node_modules/@abstract-foundation/agw-client/dist/esm/actions/deployAccount.js
import { encodeFunctionData as encodeFunctionData2, keccak256 as keccak2562, toBytes as toBytes2, zeroAddress } from "viem";

// node_modules/@abstract-foundation/agw-client/dist/esm/abis/AccountFactory.js
var AccountFactoryAbi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "_implementation",
        type: "address"
      },
      {
        internalType: "bytes4",
        name: "_initializerSelector",
        type: "bytes4"
      },
      {
        internalType: "address",
        name: "_registry",
        type: "address"
      },
      {
        internalType: "bytes32",
        name: "_proxyBytecodeHash",
        type: "bytes32"
      },
      {
        internalType: "address",
        name: "_deployer",
        type: "address"
      },
      {
        internalType: "address",
        name: "_owner",
        type: "address"
      }
    ],
    stateMutability: "nonpayable",
    type: "constructor"
  },
  {
    inputs: [],
    name: "ALREADY_CREATED",
    type: "error"
  },
  {
    inputs: [],
    name: "DEPLOYMENT_FAILED",
    type: "error"
  },
  {
    inputs: [],
    name: "INVALID_INITIALIZER",
    type: "error"
  },
  {
    inputs: [],
    name: "NOT_FROM_DEPLOYER",
    type: "error"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address"
      }
    ],
    name: "OwnableInvalidOwner",
    type: "error"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address"
      }
    ],
    name: "OwnableUnauthorizedAccount",
    type: "error"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "accountAddress",
        type: "address"
      }
    ],
    name: "AGWAccountCreated",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "accountAddress",
        type: "address"
      }
    ],
    name: "AGWAccountDeployed",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "deployer",
        type: "address"
      },
      {
        indexed: true,
        internalType: "bool",
        name: "authorized",
        type: "bool"
      }
    ],
    name: "DeployerAuthorized",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "newImplementation",
        type: "address"
      }
    ],
    name: "ImplementationChanged",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address"
      }
    ],
    name: "OwnershipTransferStarted",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address"
      }
    ],
    name: "OwnershipTransferred",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "newRegistry",
        type: "address"
      }
    ],
    name: "RegistryChanged",
    type: "event"
  },
  {
    inputs: [],
    name: "acceptOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address"
      }
    ],
    name: "accountToDeployer",
    outputs: [
      {
        internalType: "address",
        name: "deployer",
        type: "address"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "accountAddress",
        type: "address"
      }
    ],
    name: "agwAccountCreated",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "deployer",
        type: "address"
      }
    ],
    name: "authorizedDeployers",
    outputs: [
      {
        internalType: "bool",
        name: "authorized",
        type: "bool"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newImplementation",
        type: "address"
      },
      {
        internalType: "bytes4",
        name: "newInitializerSelector",
        type: "bytes4"
      }
    ],
    name: "changeImplementation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newRegistry",
        type: "address"
      }
    ],
    name: "changeRegistry",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "salt",
        type: "bytes32"
      },
      {
        internalType: "bytes",
        name: "initializer",
        type: "bytes"
      }
    ],
    name: "deployAccount",
    outputs: [
      {
        internalType: "address",
        name: "accountAddress",
        type: "address"
      }
    ],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "salt",
        type: "bytes32"
      }
    ],
    name: "getAddressForSalt",
    outputs: [
      {
        internalType: "address",
        name: "accountAddress",
        type: "address"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "salt",
        type: "bytes32"
      },
      {
        internalType: "address",
        name: "_implementation",
        type: "address"
      }
    ],
    name: "getAddressForSaltAndImplementation",
    outputs: [
      {
        internalType: "address",
        name: "accountAddress",
        type: "address"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "implementationAddress",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "initializerSelector",
    outputs: [
      {
        internalType: "bytes4",
        name: "",
        type: "bytes4"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "pendingOwner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "proxyBytecodeHash",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "registry",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "salt",
        type: "bytes32"
      }
    ],
    name: "saltToAccount",
    outputs: [
      {
        internalType: "address",
        name: "accountAddress",
        type: "address"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "deployer",
        type: "address"
      },
      {
        internalType: "bool",
        name: "authorized",
        type: "bool"
      }
    ],
    name: "setDeployer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newOwner",
        type: "address"
      }
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
];
var AccountFactory_default = AccountFactoryAbi;

// node_modules/@abstract-foundation/agw-client/dist/esm/constants.js
import { abstract, abstractTestnet as abstractTestnet2 } from "viem/chains";
var SMART_ACCOUNT_FACTORY_ADDRESS = "0x9B947df68D35281C972511B3E7BC875926f26C1A";
var EOA_VALIDATOR_ADDRESS = "0x74b9ae28EC45E3FA11533c7954752597C3De3e7A";
var AGW_LINK_DELEGATION_RIGHTS = "0xc10dcfe266c1f71ef476efbd3223555750dc271e4115626b";
var NON_EXPIRING_DELEGATION_RIGHTS = `${AGW_LINK_DELEGATION_RIGHTS}000000ffffffffff`;
var BRIDGEHUB_ADDRESS = {
  [abstractTestnet2.id]: "0x35A54c8C757806eB6820629bc82d90E056394C92",
  [abstract.id]: "0x303a465b659cbb0ab36ee643ea362c509eeb5213"
};

// node_modules/@abstract-foundation/agw-client/dist/esm/utils.js
import { BaseError as BaseError2, encodeFunctionData, fromHex, isHex, keccak256, toBytes, toHex } from "viem";
import { parseAccount } from "viem/accounts";
import { abstract as abstract2, abstractTestnet as abstractTestnet3 } from "viem/chains";
import {} from "viem/zksync";

// node_modules/@abstract-foundation/agw-client/dist/esm/eip712.js
import {} from "viem";
import { assertRequest } from "viem/utils";
import {} from "viem/zksync";

// node_modules/@abstract-foundation/agw-client/dist/esm/errors/eip712.js
import { BaseError } from "viem";

// node_modules/@abstract-foundation/agw-client/dist/esm/types/call.js
import {} from "viem";

// node_modules/@abstract-foundation/agw-client/dist/esm/utils.js
var VALID_CHAINS = {
  [abstractTestnet3.id]: abstractTestnet3,
  [abstract2.id]: abstract2
};
async function getSmartAccountAddressFromInitialSigner(initialSigner, publicClient) {
  if (initialSigner === void 0) {
    throw new Error("Initial signer is required to get smart account address");
  }
  const addressBytes = toBytes(initialSigner);
  const salt = keccak256(addressBytes);
  const accountAddress = await publicClient.readContract({
    address: SMART_ACCOUNT_FACTORY_ADDRESS,
    abi: AccountFactory_default,
    functionName: "getAddressForSalt",
    args: [salt]
  });
  return accountAddress;
}
async function isSmartAccountDeployed(publicClient, address) {
  const bytecode = await publicClient.getCode({
    address
  });
  return bytecode !== void 0;
}
function getInitializerCalldata(initialOwnerAddress, validatorAddress, initialCall) {
  return encodeFunctionData({
    abi: [
      {
        name: "initialize",
        type: "function",
        inputs: [
          { name: "initialK1Owner", type: "address" },
          { name: "initialK1Validator", type: "address" },
          { name: "modules", type: "bytes[]" },
          {
            name: "initCall",
            type: "tuple",
            components: [
              { name: "target", type: "address" },
              { name: "allowFailure", type: "bool" },
              { name: "value", type: "uint256" },
              { name: "callData", type: "bytes" }
            ]
          }
        ],
        outputs: [],
        stateMutability: "nonpayable"
      }
    ],
    functionName: "initialize",
    args: [initialOwnerAddress, validatorAddress, [], initialCall]
  });
}

// node_modules/@abstract-foundation/agw-client/dist/esm/actions/deployAccount.js
async function deployAccount(params) {
  const { initialSignerAddress, walletClient, publicClient, ...rest } = params;
  const initialSigner = initialSignerAddress ?? walletClient.account.address;
  const address = await getSmartAccountAddressFromInitialSigner(initialSigner, publicClient);
  let deploymentTransaction = void 0;
  const isDeployed = await isSmartAccountDeployed(publicClient, address);
  if (!isDeployed) {
    const initializerCallData = getInitializerCalldata(initialSigner, EOA_VALIDATOR_ADDRESS, {
      allowFailure: false,
      callData: "0x",
      value: 0n,
      target: zeroAddress
    });
    const addressBytes = toBytes2(initialSigner);
    const salt = keccak2562(addressBytes);
    const deploymentCalldata = encodeFunctionData2({
      abi: AccountFactory_default,
      functionName: "deployAccount",
      args: [salt, initializerCallData]
    });
    deploymentTransaction = await walletClient.sendTransaction({
      account: walletClient.account,
      to: SMART_ACCOUNT_FACTORY_ADDRESS,
      data: deploymentCalldata,
      ...rest
    });
  }
  return {
    smartAccountAddress: address,
    deploymentTransaction
  };
}

// node_modules/@abstract-foundation/agw-client/dist/esm/actions/getLinkedAccounts.js
import { checksumAddress, getAddress, InvalidAddressError, isAddress as isAddress2 } from "viem";
import { readContract } from "viem/actions";
import { getAction, parseAccount as parseAccount2 } from "viem/utils";
import {} from "viem/zksync";

// node_modules/@abstract-foundation/agw-client/dist/esm/errors/account.js
import { BaseError as BaseError3 } from "viem";

// node_modules/@abstract-foundation/agw-client/dist/esm/actions/getLinkedAgw.js
import { BaseError as BaseError4, getAddress as getAddress2, InvalidAddressError as InvalidAddressError2, isAddress as isAddress3 } from "viem";
import { readContract as readContract2 } from "viem/actions";
import { getAction as getAction2, parseAccount as parseAccount3 } from "viem/utils";
import {} from "viem/zksync";

// node_modules/@abstract-foundation/agw-client/dist/esm/sessions.js
import { encodeAbiParameters, getAbiItem, getAddress as getAddress3, keccak256 as keccak2563 } from "viem";
var LimitType;
(function(LimitType2) {
  LimitType2[LimitType2["Unlimited"] = 0] = "Unlimited";
  LimitType2[LimitType2["Lifetime"] = 1] = "Lifetime";
  LimitType2[LimitType2["Allowance"] = 2] = "Allowance";
})(LimitType || (LimitType = {}));
var LimitUnlimited = {
  limitType: LimitType.Unlimited,
  limit: 0n,
  period: 0n
};
var LimitZero = {
  limitType: LimitType.Lifetime,
  limit: 0n,
  period: 0n
};
var ConstraintCondition;
(function(ConstraintCondition2) {
  ConstraintCondition2[ConstraintCondition2["Unconstrained"] = 0] = "Unconstrained";
  ConstraintCondition2[ConstraintCondition2["Equal"] = 1] = "Equal";
  ConstraintCondition2[ConstraintCondition2["Greater"] = 2] = "Greater";
  ConstraintCondition2[ConstraintCondition2["Less"] = 3] = "Less";
  ConstraintCondition2[ConstraintCondition2["GreaterEqual"] = 4] = "GreaterEqual";
  ConstraintCondition2[ConstraintCondition2["LessEqual"] = 5] = "LessEqual";
  ConstraintCondition2[ConstraintCondition2["NotEqual"] = 6] = "NotEqual";
})(ConstraintCondition || (ConstraintCondition = {}));
var SessionStatus;
(function(SessionStatus2) {
  SessionStatus2[SessionStatus2["NotInitialized"] = 0] = "NotInitialized";
  SessionStatus2[SessionStatus2["Active"] = 1] = "Active";
  SessionStatus2[SessionStatus2["Closed"] = 2] = "Closed";
  SessionStatus2[SessionStatus2["Expired"] = 3] = "Expired";
})(SessionStatus || (SessionStatus = {}));

// node_modules/@abstract-foundation/agw-client/dist/esm/actions/linkToAgw.js
import { createPublicClient as createPublicClient2, decodeEventLog, encodeFunctionData as encodeFunctionData3, http as http2 } from "viem";
import { writeContract } from "viem/actions";
import { getAction as getAction3, parseAccount as parseAccount4 } from "viem/utils";
import { publicActionsL2 } from "viem/zksync";

// node_modules/@abstract-foundation/agw-client/dist/esm/actions/sendTransactionBatch.js
import { encodeFunctionData as encodeFunctionData8 } from "viem";
import {} from "viem/zksync";

// node_modules/@abstract-foundation/agw-client/dist/esm/actions/sendPrivyTransaction.js
import { toHex as toHex2 } from "viem";
import {} from "viem/zksync";

// node_modules/@abstract-foundation/agw-client/dist/esm/actions/sendTransactionInternal.js
import { BaseError as BaseError15 } from "viem";
import { getChainId as getChainId3, sendRawTransaction } from "viem/actions";
import { assertCurrentChain as assertCurrentChain2, getAction as getAction8, getTransactionError as getTransactionError2, parseAccount as parseAccount11 } from "viem/utils";
import {} from "viem/zksync";

// node_modules/@abstract-foundation/agw-client/dist/esm/errors/insufficientBalance.js
import { BaseError as BaseError5 } from "viem";

// node_modules/@abstract-foundation/agw-client/dist/esm/actions/prepareTransaction.js
import { BaseError as BaseError14, encodeFunctionData as encodeFunctionData7, ExecutionRevertedError, formatGwei, keccak256 as keccak2565, RpcRequestError, toBytes as toBytes4 } from "viem";
import {} from "viem/accounts";
import { estimateGas, getBalance, getChainId as getChainId_, getTransactionCount } from "viem/actions";
import { assertRequest as assertRequest2, getAction as getAction7, parseAccount as parseAccount10 } from "viem/utils";
import { estimateFee } from "viem/zksync";

// node_modules/@abstract-foundation/agw-client/dist/esm/sessionClient.js
import { createClient as createClient2, createPublicClient as createPublicClient4, createWalletClient as createWalletClient3, custom, http as http4 } from "viem";
import { toAccount as toAccount2 } from "viem/accounts";

// node_modules/@abstract-foundation/agw-client/dist/esm/walletActions.js
import { walletActions } from "viem";
import { parseAccount as parseAccount9 } from "viem/accounts";
import { getChainId as getChainId2 } from "viem/actions";
import {} from "viem/zksync";

// node_modules/@abstract-foundation/agw-client/dist/esm/abstractClient.js
import { createClient, createPublicClient as createPublicClient3, createWalletClient as createWalletClient2, http as http3 } from "viem";
import { toAccount } from "viem/accounts";
import {} from "viem/zksync";

// node_modules/@abstract-foundation/agw-client/dist/esm/actions/createSession.js
import { concatHex } from "viem";
import { readContract as readContract3, writeContract as writeContract2 } from "viem/actions";
import { getAction as getAction4 } from "viem/utils";

// node_modules/@abstract-foundation/agw-client/dist/esm/actions/deployContract.js
import {} from "viem";
import { encodeDeployData } from "viem/zksync";

// node_modules/@abstract-foundation/agw-client/dist/esm/actions/sendTransaction.js
import { BaseError as BaseError6 } from "viem";
import { getTransactionError, parseAccount as parseAccount5 } from "viem/utils";
import {} from "viem/zksync";

// node_modules/@abstract-foundation/agw-client/dist/esm/actions/revokeSessions.js
import {} from "viem";
import { writeContract as writeContract3 } from "viem/actions";
import { getAction as getAction5 } from "viem/utils";

// node_modules/@abstract-foundation/agw-client/dist/esm/actions/sendTransactionForSession.js
import { BaseError as BaseError7 } from "viem";
import {} from "viem/zksync";

// node_modules/@abstract-foundation/agw-client/dist/esm/actions/signMessage.js
import { bytesToString, fromHex as fromHex2, hashMessage } from "viem";

// node_modules/@abstract-foundation/agw-client/dist/esm/getAgwTypedSignature.js
import { encodeAbiParameters as encodeAbiParameters2, encodeFunctionData as encodeFunctionData4, keccak256 as keccak2564, parseAbiParameters, serializeErc6492Signature, toBytes as toBytes3, zeroAddress as zeroAddress2 } from "viem";
import { getCode, signTypedData } from "viem/actions";

// node_modules/@abstract-foundation/agw-client/dist/esm/actions/signTransaction.js
import { BaseError as BaseError9, encodeAbiParameters as encodeAbiParameters3, parseAbiParameters as parseAbiParameters2 } from "viem";
import { getChainId, readContract as readContract4, signTypedData as signTypedData2 } from "viem/actions";
import { assertCurrentChain, getAction as getAction6, parseAccount as parseAccount6 } from "viem/utils";
import {} from "viem/zksync";

// node_modules/@abstract-foundation/agw-client/dist/esm/sessionValidator.js
import { BaseError as BaseError8, toFunctionSelector } from "viem";
import { abstract as abstract3 } from "viem/chains";
import { decodeAbiParameters, decodeFunctionData } from "viem/utils";
var restrictedSelectors = /* @__PURE__ */ new Set([
  toFunctionSelector("function setApprovalForAll(address, bool)"),
  toFunctionSelector("function approve(address, uint256)"),
  toFunctionSelector("function transfer(address, uint256)")
]);
var SessionKeyPolicyStatus;
(function(SessionKeyPolicyStatus2) {
  SessionKeyPolicyStatus2[SessionKeyPolicyStatus2["Unset"] = 0] = "Unset";
  SessionKeyPolicyStatus2[SessionKeyPolicyStatus2["Allowed"] = 1] = "Allowed";
  SessionKeyPolicyStatus2[SessionKeyPolicyStatus2["Denied"] = 2] = "Denied";
})(SessionKeyPolicyStatus || (SessionKeyPolicyStatus = {}));

// node_modules/@abstract-foundation/agw-client/dist/esm/actions/signTransactionBatch.js
import {} from "viem";
import {} from "viem/zksync";

// node_modules/@abstract-foundation/agw-client/dist/esm/actions/signTransactionForSession.js
import { BaseError as BaseError10 } from "viem";
import {} from "viem/zksync";

// node_modules/@abstract-foundation/agw-client/dist/esm/actions/signTypedData.js
import { BaseError as BaseError11, fromRlp, hashTypedData } from "viem";
import {} from "viem/accounts";

// node_modules/@abstract-foundation/agw-client/dist/esm/actions/writeContract.js
import { BaseError as BaseError12, encodeFunctionData as encodeFunctionData5 } from "viem";
import { getContractError, parseAccount as parseAccount7 } from "viem/utils";
import {} from "viem/zksync";

// node_modules/@abstract-foundation/agw-client/dist/esm/actions/writeContractForSession.js
import { BaseError as BaseError13, encodeFunctionData as encodeFunctionData6 } from "viem";
import { getContractError as getContractError2, parseAccount as parseAccount8 } from "viem/utils";
import {} from "viem/zksync";

// src/tools/ab_agwCreateWallet.ts
var ParamsSchema4 = z4.object({
  signer: z4.string().optional().describe(
    "EOA signer address or ENS. If omitted, uses the server wallet\u2019s account as the initial signer"
  )
});
function registerAgwCreateWallet(server2) {
  server2.addTool({
    name: "ab_agw_create_wallet",
    description: `Deploy a new Abstract Global Wallet (smart-contract account) for a given signer.

The tool wraps @abstract-foundation/agw-client\u2019s \`deployAccount\` helper.

Returns both the smart-account address and the deployment tx hash (\`undefined\` when the account already exists).`,
    parameters: ParamsSchema4,
    annotations: { destructiveHint: true, title: "AGW \u2022 Deploy Smart Account" },
    execute: async (args, { log }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      let signerAddress = void 0;
      if (args.signer) {
        const resolved = await resolveAddress(args.signer);
        if (!resolved)
          throw new UserError4("Unable to resolve signer address");
        signerAddress = resolved;
      }
      log.info("Deploying AGW smart account", { signerAddress: signerAddress ?? walletClient.account.address });
      const { smartAccountAddress } = await deployAccount({
        walletClient,
        publicClient,
        initialSignerAddress: signerAddress
      });
      return smartAccountAddress;
    }
  });
}

// src/tools/ab_generateEoaWallet.ts
import "fastmcp";
import { randomBytes } from "crypto";
import { privateKeyToAccount as privateKeyToAccount2 } from "viem/accounts";
import { z as z5 } from "zod";
var EmptySchema = z5.object({}).describe("No parameters required");
function registerGenerateEoaWallet(server2) {
  server2.addTool({
    name: "ab_generate_wallet",
    description: `Generate a brand-new Externally Owned Account (EOA).

RETURNS
\u2022 privateKey \u2013 0x-prefixed 32-byte hex string
\u2022 address \u2013 checksummed Ethereum/Abstract address

COMMON USES
\u2022 Let agents spin up their own keypairs before funding or deploying smart-accounts.

SECURITY
\u2022 The private key is returned in plaintext. Ensure the caller stores it securely and never logs it.`,
    parameters: EmptySchema,
    annotations: { destructiveHint: false, title: "Generate EOA Wallet" },
    execute: async (_args, _ctx) => {
      const pkBytes = randomBytes(32);
      const privateKey = `0x${pkBytes.toString("hex")}`;
      const account = privateKeyToAccount2(privateKey);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ privateKey, address: account.address })
          }
        ]
      };
    }
  });
}

// src/server.ts
try {
  dotenv2.config();
} catch (error) {
  console.log("No .env file found or failed to load - using environment variables from client");
}
var server = new FastMCP6({ name: "Society Abstract MCP", version: "0.1.0" });
registerAbDeployToken(server);
registerGetBalance(server);
registerTransferToken(server);
registerAgwCreateWallet(server);
registerGenerateEoaWallet(server);
if (import.meta.url === `file://${process.argv[1]}`) {
  await server.start();
}
export {
  server
};
//# sourceMappingURL=server.js.map