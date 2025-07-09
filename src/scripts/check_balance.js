#!/usr/bin/env node
import { argv, exit } from "process";
import { createPublicClient, http, formatEther } from "viem";

const NETWORKS = {
    mainnet: {
        name: "Ethereum Mainnet",
        rpc: process.env.MAINNET_RPC_URL
            ? [process.env.MAINNET_RPC_URL]
            : [
                "https://ethereum-rpc.publicnode.com",
                "https://eth.llamarpc.com",
                "https://cloudflare-eth.com",
            ],
        chainId: 1,
    },
    sepolia: {
        name: "Sepolia Testnet",
        rpc: process.env.SEPOLIA_RPC_URL
            ? [process.env.SEPOLIA_RPC_URL]
            : ["https://rpc.sepolia.org", "https://sepolia.publicnode.com"],
        chainId: 11155111,
    },
    abstract: {
        name: "Abstract Testnet",
        rpc: [process.env.ABSTRACT_RPC_URL ?? "https://api.testnet.abs.xyz"],
        chainId: 11124,
    },
};

function usage() {
    // eslint-disable-next-line no-console
    console.error(`Usage: npm run balance [address]\nIf no address is provided, uses ABSTRACT_WALLET env var.\nOptional: set env MAINNET_RPC_URL, SEPOLIA_RPC_URL, ABSTRACT_RPC_URL to override RPC endpoints.`);
}

const address = argv[2] || process.env.ABSTRACT_WALLET;
if (!address) {
    usage();
    exit(1);
}

if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    // eslint-disable-next-line no-console
    console.error("Invalid address provided.");
    exit(1);
}

(async () => {
    try {
        for (const key of Object.keys(NETWORKS)) {
            const { name, rpc } = NETWORKS[key];
            const rpcList = Array.isArray(rpc) ? rpc : [rpc];
            let eth = null;
            for (const url of rpcList) {
                try {
                    const client = createPublicClient({ transport: http(url) });
                    const balance = await client.getBalance({ address });
                    eth = formatEther(balance);
                    break; // succeeded
                } catch (err) {
                    continue; // try next endpoint
                }
            }
            if (eth === null) {
                console.error(`All RPCs failed for ${name}`);
                continue;
            }
            // eslint-disable-next-line no-console
            console.log(`${name}: ${eth} ETH`);
        }
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Unexpected error:", err);
        exit(1);
    }
})(); 