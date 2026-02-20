// Runtime shim for direct Node execution of TypeScript entrypoints.
// This lets `client.ts` import `./config.js` while still using `config.ts` source.
export * from "./config.ts";

