# Society Abstract MCP

FastMCP TypeScript server providing wallet, token and NFT utilities for **Abstract** Testnet/Mainnet.

## Features

* ✅ `ab_get_balance` – native / ERC-20 balance with ENS support
* ✅ `ab_transfer_token` – native ETH & ERC-20 transfers
* ✅ `ab_create_wallet` – deterministic smart-account deploy via factory
* ✅ `ab_deploy_token` – one-shot ERC-20 deployment (embedded byte-code)
* ✅ `ab_mint_nft` – mint ERC-721 via `mint(address,uint256)`
* ✅ `ab_bridge_nft` – LayerZero ONFT bridge helper
* ✅ `ab_agw_create_wallet` – deploy **Abstract Global Wallet** smart account
* 🔒 Comprehensive mocked **unit-tests** (`npm run test`)
* 🌐 Live **integration-tests** against Abstract Testnet (`INTEGRATION=1 npm run test:int`)

---

## Quick Start

```bash
# 1. Install deps
npm install

# 2. Copy & edit .env
cp .env.example .env
#   ↳ fill in PRIVATE_KEY etc.  (see below)

# 3. Run dev server (hot-reload TS)
npm run dev
#   → listens on PORT (default 3099)

# 4. Unit tests (mocked)
npm run test

# 5. Live tests (⚠️ spends gas!)
INTEGRATION=1 npm run test:int
```

### Environment variables (`.env`) - Optional for Development

> **Note:** The .env file is optional and only needed for development. For production MCP usage, all variables should be passed by the client.

| Var | Required | Example | Notes |
|-----|----------|---------|-------|
| `ABSTRACT_PRIVATE_KEY` | **Yes** | `0xabc…123` | EOA that pays gas – keep secret! |
| `ABSTRACT_RPC_URL` | No | `https://api.testnet.abs.xyz` | Fallback URL used if empty |
| `TESTNET` | No | `true` | `true` → use Abstract Testnet, anything else ⇒ Mainnet |

> **Tip:** Any missing variables are surfaced at runtime with clear errors.

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start MCP server via `ts-node` |
| `npm run build` | Compile to `dist/` using **tsup** |
| `npm start` | Run compiled server (`dist/server.js`) |
| `npm run test` | Unit tests (mocked) |
| `npm run test:int` | Integration tests – require live funds & `INTEGRATION=1` |
| `npm run balance` | Quick multi-network balance checker |

---

## MCP-Server Client Configuration (Cursor example)

### Local build
```jsonc
{
  "mcpServers": {
    "society-abstract-mcp-local": {
      "command": "node",
      "args": ["/absolute/path/to/society_abstract_mcp/dist/server.js"],
      "env": {
        "ABSTRACT_PRIVATE_KEY": "Your Abstract Private Key",
        "ABSTRACT_RPC_URL": "https://api.testnet.abs.xyz",
        "TESTNET": "true",
        "PORT": "3101",
        "MCP_DISABLE_PINGS": "true"
      }
    }
  }
}
```

### On-the-fly via **npx**
```jsonc
{
  "mcpServers": {
    "society-abstract-mcp": {
      "command": "npx",
      "args": ["-y", "society-abstract-mcp@latest"],
      "env": {
        "ABSTRACT_PRIVATE_KEY": "Your Abstract Private Key",
        "ABSTRACT_RPC_URL": "https://api.testnet.abs.xyz",
        "TESTNET": "true",
        "PORT": "3101",
        "MCP_DISABLE_PINGS": "true"
      }
    }
  }
}
```

---

## Building for Production

```bash
npm run build          # outputs ESM+CJS+types into dist/
NODE_ENV=production node dist/server.js
```

> **Note**: `server.ts` uses top-level `await`, so the build target is ES2022 (supported by modern Node ≥ 16.14).

---

## Contributing / Debugging

* **Logs**: set `DEBUG=true` in `.env` for verbose output.
* **Gas usage**: integration tests spend ~0.00005 ETH per run.
* **Troubleshooting**: if `deployAccount` reverts, the account likely already exists – use a fresh `salt`.
* **Extending**: follow the `src/tools` pattern – each register function adds a typed FastMCP tool.

PRs & issues welcome! 🎉
