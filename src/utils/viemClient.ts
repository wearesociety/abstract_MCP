import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import type { PublicClient, WalletClient, Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore dotenv types resolution conflict under NodeNext
import dotenv from "dotenv";

dotenv.config();

// ---------- Chain Definitions ----------

export const abstractTestnet: Chain = defineChain({
    id: 11124,
    name: "Abstract Testnet",
    network: "abstract-testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
        default: {
            http: [process.env.ABSTRACT_RPC_URL ?? "https://api.testnet.abs.xyz"],
        },
        public: {
            http: [process.env.ABSTRACT_RPC_URL ?? "https://api.testnet.abs.xyz"],
        },
    },
});

export const abstractMainnet: Chain = defineChain({
    id: 2741,
    name: "Abstract Mainnet",
    network: "abstract-mainnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
        default: {
            http: [process.env.ABSTRACT_RPC_URL ?? "https://api.mainnet.abs.xyz/"],
        },
        public: {
            http: [process.env.ABSTRACT_RPC_URL ?? "https://api.mainnet.abs.xyz/"],
        },
    },
});

// Choose chain based on env (default: testnet)
function getChain(): Chain {
    const target = (process.env.TESTNET ?? "true").toLowerCase() === "true" ? "testnet" : "mainnet";
    return target === "mainnet" ? abstractMainnet : abstractTestnet;
}

// ---------- Singleton Clients ----------

let _publicClient: PublicClient | undefined;
let _walletClient: WalletClient | undefined;

export function getPublicClient(): PublicClient {
    if (!_publicClient) {
        const chain = getChain();
        _publicClient = createPublicClient({
            chain,
            transport: http(chain.rpcUrls.default.http[0]),
        });
    }
    return _publicClient;
}

export function getWalletClient(): WalletClient {
    if (!_walletClient) {
        let pk = process.env.ABSTRACT_PRIVATE_KEY ?? process.env.ABSTRACT_PRIVATE_KEY;
        if (!pk) {
            throw new Error("ABSTRACT_PRIVATE_KEY env variable is required");
        }
        if (!pk.startsWith("0x")) {
            pk = `0x${pk}`;
        }
        const account = privateKeyToAccount(pk as `0x${string}`);
        const chain = getChain();
        _walletClient = createWalletClient({
            chain,
            transport: http(chain.rpcUrls.default.http[0]),
            account,
        });
    }
    return _walletClient;
} 