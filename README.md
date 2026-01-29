# Mogate RWA Platform

**Multi-chain RWA platform** implementing **dark pool raffles** and **sealed-bid auctions** for real-world assets, leveraging cross-chain infrastructure for privacy and interoperability.

🌐 **[mogate.io](https://mogate.io)** | 🧪 **[testnet.mogate.io](https://testnet.mogate.io)** - **Test the dark pool raffle implementation**

## 🌐 Cross-Chain Architecture

Each blockchain network has its **own branch** with network-specific smart contracts, SDKs, and offchain workers:

- **[`main`](https://github.com/dellwatson/moga-mogate/tree/main)** ⭐ **YOU ARE HERE** — Main branch
- **[`solana-network`](https://github.com/dellwatson/moga-mogate/tree/solana-network)** — Solana implementation
- **[`casper-network`](https://github.com/dellwatson/moga-mogate/tree/casper-network)** — Casper Network implementation
- **[`aleo-network`](https://github.com/dellwatson/moga-mogate/tree/aleo-network)** — Aleo Network implementation (privacy-focused)
- **[`evm-network`](https://github.com/dellwatson/moga-mogate/tree/evm-network)** — EVM-compatible chains (Polygon, Arbitrum, Ethereum)
- **[`bridge-hub`](https://github.com/dellwatson/moga-mogate/tree/bridge-hub)** — Cross-chain middleware & bridging layer

**Switch branches to view network-specific implementations.**
