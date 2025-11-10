/**
 * Backend API Server for RWA Raffle
 * 
 * Provides REST endpoints for:
 * - Organizer management (CRUD)
 * - Permit issuance (ed25519 signing)
 * - Raffle queries
 */

import express, { Request, Response } from "express";
import cors from "cors";
import { randomBytes } from "crypto";
import {
  registerOrganizer,
  getOrganizer,
  listOrganizers,
  updateOrganizerStatus,
  issuePermit,
  seedDemoOrganizers,
  OrganizerProfile,
  RafflePermitRequest,
} from "./organizer_db";

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.PORT || 3001;
const PROGRAM_ID = process.env.RWA_RAFFLE_PROGRAM_ID || "5xAQW7YPsYjHkeWfuqa55ZbeUDcLJtsRUiU4HcCLm12M";

// Note: We do not sign permits on the backend. The organizer's wallet signs the binary message.

// Admin API key (for organizer management endpoints)
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "dev-admin-key-change-in-production";

// ============================================================================
// EXPRESS APP
// ============================================================================

const app = express();

app.use(cors());
app.use(express.json());

// ============================================================================
// MIDDLEWARE
// ============================================================================

function requireAdmin(req: Request, res: Response, next: Function) {
  const apiKey = req.headers["x-admin-api-key"];
  if (apiKey !== ADMIN_API_KEY) {
    return res.status(401).json({ error: "Unauthorized: Invalid admin API key" });
  }
  next();
}

// ============================================================================
// ROUTES
// ============================================================================

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "rwa-raffle-api" });
});

// ============================================================================
// ORGANIZER MANAGEMENT (Admin-only)
// ============================================================================

/**
 * POST /admin/organizers
 * Register a new organizer
 * 
 * Body:
 * {
 *   "publicKey": "...",
 *   "enterpriseId": "...",
 *   "tier": "free" | "pro" | "enterprise",
 *   "allowedCollections": ["..."]
 * }
 */
app.post("/admin/organizers", requireAdmin, (req: Request, res: Response) => {
  try {
    const { publicKey, enterpriseId, tier, allowedCollections } = req.body;

    if (!publicKey || !enterpriseId || !tier) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const profile: OrganizerProfile = {
      publicKey,
      enterpriseId,
      tier,
      allowedCollections: allowedCollections || [],
      active: true,
      registeredAt: Math.floor(Date.now() / 1000),
    };

    registerOrganizer(profile);
    res.json({ success: true, profile });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /admin/organizers
 * List all organizers
 */
app.get("/admin/organizers", requireAdmin, (req: Request, res: Response) => {
  const organizers = listOrganizers();
  res.json({ organizers });
});

/**
 * GET /admin/organizers/:publicKey
 * Get organizer by public key
 */
app.get("/admin/organizers/:publicKey", requireAdmin, (req: Request, res: Response) => {
  const { publicKey } = req.params;
  const profile = getOrganizer(publicKey);
  
  if (!profile) {
    return res.status(404).json({ error: "Organizer not found" });
  }

  res.json({ profile });
});

/**
 * PATCH /admin/organizers/:publicKey
 * Update organizer status
 * 
 * Body:
 * {
 *   "active": true | false
 * }
 */
app.patch("/admin/organizers/:publicKey", requireAdmin, (req: Request, res: Response) => {
  try {
    const { publicKey } = req.params;
    const { active } = req.body;

    if (typeof active !== "boolean") {
      return res.status(400).json({ error: "active must be a boolean" });
    }

    updateOrganizerStatus(publicKey, active);
    res.json({ success: true, publicKey, active });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// PERMIT ISSUANCE (Public, but rate-limited in production)
// ============================================================================

/**
 * POST /permits/issue
 * Issue a permit for an organizer to create a raffle
 * 
 * Body:
 * {
 *   "organizer": "...",
 *   "enterpriseId": "...",
 *   "raffleConfig": {
 *     "requiredTickets": "500",
 *     "deadlineUnixTs": "1234567890",
 *     "autoDraw": true,
 *     "ticketMode": 2
 *   }
 * }
 * 
 * Returns:
 * {
 *   "permit": {
 *     "message": "hex string",
 *     "nonce": "hex string",
 *     "expiryUnixTs": 1234567890
 *   }
 * }
 */
app.post("/permits/issue", async (req: Request, res: Response) => {
  try {
    const { organizer, enterpriseId, raffleConfig } = req.body;

    if (!organizer || !enterpriseId || !raffleConfig) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!raffleConfig.requiredTickets || !raffleConfig.deadlineUnixTs) {
      return res.status(400).json({ error: "Invalid raffleConfig" });
    }

    // Generate nonce and expiry
    const nonce = randomBytes(16).toString("hex");
    const expiryUnixTs = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    const permitRequest: RafflePermitRequest = {
      organizer,
      enterpriseId,
      nonce,
      expiryUnixTs,
      raffleConfig: {
        requiredTickets: BigInt(raffleConfig.requiredTickets),
        deadlineUnixTs: BigInt(raffleConfig.deadlineUnixTs),
      },
      autoDraw: Boolean(raffleConfig.autoDraw ?? true),
      ticketMode: Number(raffleConfig.ticketMode ?? 0),
    };

    // Prepare permit (validates organizer and builds binary message)
    const { message, nonce: nonceBytes } = issuePermit(
      permitRequest,
      PROGRAM_ID,
    );

    res.json({
      permit: {
        message: Buffer.from(message).toString("hex"),
        nonce: Buffer.from(nonceBytes).toString("hex"),
        expiryUnixTs,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /organizers/:publicKey/status
 * Check if organizer is active (public endpoint for frontend)
 */
app.get("/organizers/:publicKey/status", (req: Request, res: Response) => {
  const { publicKey } = req.params;
  const profile = getOrganizer(publicKey);

  if (!profile) {
    return res.json({ active: false, registered: false });
  }

  res.json({
    active: profile.active,
    registered: true,
    tier: profile.tier,
    enterpriseId: profile.enterpriseId,
  });
});

// ============================================================================
// START SERVER
// ============================================================================

function startServer() {
  // Seed demo organizers for development
  if (process.env.NODE_ENV !== "production") {
    console.log("🌱 Seeding demo organizers...");
    seedDemoOrganizers();
  }

  app.listen(PORT, () => {
    console.log(`🚀 RWA Raffle API Server running on http://localhost:${PORT}`);
    console.log(`📋 Program ID: ${PROGRAM_ID}`);
    console.log(`🔑 Admin API Key: ${ADMIN_API_KEY}`);
    console.log("");
    console.log("📚 Endpoints:");
    console.log("  GET  /health");
    console.log("  POST /permits/issue");
    console.log("  GET  /organizers/:publicKey/status");
    console.log("");
    console.log("🔒 Admin Endpoints (require X-Admin-API-Key header):");
    console.log("  POST  /admin/organizers");
    console.log("  GET   /admin/organizers");
    console.log("  GET   /admin/organizers/:publicKey");
    console.log("  PATCH /admin/organizers/:publicKey");
  });
}

// Only start if run directly (not imported)
if (require.main === module) {
  startServer();
}

export { app, startServer };
