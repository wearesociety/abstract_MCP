export interface TokenInfo {
    symbol: string;
    address: `0x${string}`;
    decimals: number;
}

export const TOKENS: TokenInfo[] = [
    {
        symbol: "ETH",
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
    },
    // Add more known tokens here
];

export function getTokenBySymbol(symbol: string): TokenInfo | undefined {
    return TOKENS.find((t) => t.symbol.toLowerCase() === symbol.toLowerCase());
} 