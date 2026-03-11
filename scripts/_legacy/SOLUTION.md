# Why Scripts Can't Run Directly

## The Problem

The Aleo SDK (`@provablehq/sdk`) has **fundamental runtime incompatibilities**:

1. **Top-level await in WASM** - Doesn't work with Node.js/tsx CommonJS
2. **sync-rpc issues** - Fails in Bun runtime
3. **Module resolution** - TypeScript `.js` imports don't resolve to `.ts` files
4. **Not production-ready** - The SDK is broken for programmatic use

## The Solution: Backend API + Frontend Client

Since we can't run the SDK directly, we use **Leo CLI** (which works) and wrap it in an API.

### Architecture

```
Frontend (React/Vue)
    ↓ HTTP POST
Backend API (Node.js + Express)
    ↓ exec()
Leo CLI (Aleo toolchain)
    ↓ Broadcast
Aleo Testnet
```

### Setup

1. **Start the backend API:**

```bash
node scripts/mint-api.js
```

2. **Call from frontend:**

```javascript
import { mintNFT } from "./scripts/mint-client.js";

const result = await mintNFT(
  "aleo1yv0wuzhwr68dkstlcl4keu4j6s0d3fzhqz0fzge6fz4w3wjwmq9s6jza3u",
  "123456789field",
);

console.log("TX ID:", result.transactionId);
```

### Files

- `mint-api.js` - Backend Express server that wraps Leo CLI
- `mint-client.js` - Frontend helper with React/Vue examples
- `mint-authority.js` - **BROKEN** - Can't run due to SDK issues
- `mint-authority-frontend.js` - Example pattern (but SDK is broken)

## Why This Is The Only Way

The Aleo team's SDK is not ready for production use. The ONLY reliable way to interact with Aleo contracts programmatically is:

1. **Leo CLI** - Works perfectly
2. **Backend wrapper** - Calls Leo CLI via shell
3. **REST API** - Exposes to frontend

This is the same approach used by most Aleo projects in production.

## Alternative: Wait for SDK Fix

Monitor the Aleo SDK repo for fixes:

- https://github.com/AleoHQ/sdk

Until then, use the backend API approach.
