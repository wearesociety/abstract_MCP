<div align="center">
  <img src="./assets/abstract_mcp.png" alt="Abstract MCP Logo">
  
  # Society Abstract MCP
  
  **FastMCP TypeScript server providing comprehensive wallet, token and smart contract utilities for Abstract Testnet/Mainnet**
  
  ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
  ![Abstract](https://img.shields.io/badge/Abstract-000000?style=for-the-badge&logo=ethereum&logoColor=white)
  ![FastMCP](https://img.shields.io/badge/FastMCP-FF6B6B?style=for-the-badge)
  
</div>

---

## 🛠️ Available Tools

### **1. `ab_get_balance` - Balance Checker**
Get native ETH or ERC-20 token balance for any address with ENS support.

**Parameters:**
- `address` (required): Wallet address or ENS name to check balance for
- `tokenAddress` (optional): ERC-20 contract address for token balance
- `tokenSymbol` (optional): Token symbol (e.g., "USDC") for well-known tokens

**Example Usage:**
```typescript
// Get native ETH balance
{ address: "0x1234...abcd" }

// Get ERC-20 balance by contract
{ address: "vitalik.eth", tokenAddress: "0xA0b86a33E6F..." }

// Get balance by token symbol
{ address: "0x1234...abcd", tokenSymbol: "USDC" }
```

**Returns:** Human-readable balance as string (e.g., "1.234567")

---

### **2. `ab_transfer_token` - Token Transfer**
Transfer native ETH or ERC-20 tokens to another address with ENS support.

**Parameters:**
- `to` (required): Recipient address or ENS name
- `amount` (required): Amount to transfer in human-readable format
- `tokenAddress` (optional): ERC-20 contract address for token transfers
- `tokenSymbol` (optional): Token symbol for well-known tokens

**Example Usage:**
```typescript
// Transfer native ETH
{ to: "0x1234...abcd", amount: "0.1" }

// Transfer ERC-20 by contract
{ to: "vitalik.eth", amount: "100", tokenAddress: "0xA0b86a33E6F..." }

// Transfer by token symbol
{ to: "0x1234...abcd", amount: "50", tokenSymbol: "USDC" }
```

**Returns:** Transaction hash of the successful transfer

---

### **3. `ab_deploy_token_erc20` - ERC-20 Token Deployment**
Deploy a new ERC-20 BasicToken contract to Abstract network.

**Parameters:**
- `name` (required): Token name (e.g., "DemoToken")
- `symbol` (required): Token symbol/ticker (e.g., "DMT")
- `initialSupply` (required): Total supply in wei (18 decimals) as string

**Example Usage:**
```typescript
// Deploy 1000 tokens (1000 * 10^18 wei)
{
  name: "MyToken",
  symbol: "MTK",
  initialSupply: "1000000000000000000000"
}
```

**Returns:** Deployed contract address and deployment details

---

### **4. `ab_agw_create_wallet` - Abstract Global Wallet Creation**
Deploy a new Abstract Global Wallet (smart contract account) for a given signer.

**Parameters:**
- `signer` (optional): EOA signer address or ENS name. If omitted, uses server wallet as initial signer

**Example Usage:**
```typescript
// Create AGW with specific signer
{ signer: "0x1234...abcd" }

// Create AGW with server wallet as signer
{ }
```

**Returns:** Smart account address and deployment transaction hash

---

### **5. `ab_generate_wallet` - EOA Wallet Generation**
Generate a brand-new Externally Owned Account (EOA) with private key and address.

**Parameters:**
- `random_string` (required): Any string for entropy (can be anything)

**Example Usage:**
```typescript
{ random_string: "my-random-seed" }
```

**Returns:** 
- `privateKey`: 0x-prefixed 32-byte hex string
- `address`: Checksummed Ethereum/Abstract address

**⚠️ Security Note:** Store the private key securely and never log it.

---

## 🚀 Quick Start

### For MCP Client Integration

#### Using NPX (Recommended)
```jsonc
{
  "mcpServers": {
    "society-abstract-mcp": {
      "command": "npx",
      "args": ["-y", "society-abstract-mcp@0.1.4"],
      "env": {
        "ABSTRACT_PRIVATE_KEY": "your-private-key-here",
        "ABSTRACT_RPC_URL": "https://api.testnet.abs.xyz",
        "TESTNET": "true",
        "PORT": "3101",
        "MCP_DISABLE_PINGS": "true"
      }
    }
  }
}
```

#### Using Local Build
```jsonc
{
  "mcpServers": {
    "society-abstract-mcp-local": {
      "command": "node",
      "args": ["/path/to/your/society_abstract_mcp/dist/server.js"],
      "env": {
        "ABSTRACT_PRIVATE_KEY": "your-private-key-here",
        "ABSTRACT_RPC_URL": "https://api.testnet.abs.xyz",
        "TESTNET": "true",
        "PORT": "3101",
        "MCP_DISABLE_PINGS": "true"
      }
    }
  }
}
```

### For Development

```bash
# 1. Install dependencies
npm install

# 2. Build the project
npm run build

# 3. Run development server
npm run dev

# 4. Run tests
npm run test

# 5. Run integration tests (requires funds)
INTEGRATION=1 npm run test:int
```

---

## 📋 Environment Variables

**Required for MCP Client:**
- `ABSTRACT_PRIVATE_KEY`: EOA private key that pays gas fees
- `ABSTRACT_RPC_URL`: Abstract network RPC URL
- `TESTNET`: "true" for testnet, "false" for mainnet

**Optional for MCP Client:**
- `PORT`: HTTP port for the MCP server (default: 3101)
- `MCP_DISABLE_PINGS`: "true" to disable ping messages

> **Note:** No .env file needed for production. All variables should be passed by the MCP client.

---

## 🏗️ Build & Deploy

```bash
# Build for production
npm run build

# Start production server
npm start

# Build outputs to dist/ with:
# - ESM modules
# - TypeScript definitions
# - Copied JavaScript assets
```

---

## 🧪 Testing

- **Unit Tests**: `npm run test` (mocked, no gas required)
- **Integration Tests**: `INTEGRATION=1 npm run test:int` (requires testnet funds)
- **Balance Checker**: `npm run balance` (multi-network balance tool)

---

## 📖 Technical Details

- **Framework**: FastMCP with TypeScript
- **Networks**: Abstract Testnet/Mainnet
- **Standards**: ERC-20 tokens, Abstract Global Wallets
- **Dependencies**: viem, zksync-ethers, @abstract-foundation/agw-client
- **Build Target**: ES2022 (Node.js ≥ 16.14)

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/society-abstract-mcp/issues)
- **Documentation**: This README and inline code documentation
- **Community**: Join our [Discord](https://discord.gg/your-invite)

---

<div align="center">
  <b>Built with ❤️ by the Society Team</b>
</div>
