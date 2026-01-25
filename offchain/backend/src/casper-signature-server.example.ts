/**
 * Example: Casper Signature Backend Server
 *
 * Standalone Express server for signing Casper data.
 * Can be integrated into existing backend or run separately.
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { setupSignatureRoutes } from "./casper-signature-api";

dotenv.config();

const app = express();
const PORT = process.env.CASPER_PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Setup Casper signature routes
setupSignatureRoutes(app);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "casper-signature-service",
    timestamp: Date.now(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Casper Signature Server running on port ${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  POST /api/casper/sign-data`);
  console.log(`  POST /api/casper/verify-signature`);
  console.log(`  GET  /api/casper/signer-public-key`);
  console.log(`  POST /api/casper/sign-structured-data`);
});

export default app;
