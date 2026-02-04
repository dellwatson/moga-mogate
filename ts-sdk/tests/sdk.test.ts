import { describe, expect, it } from "bun:test";
import { evm, tee } from "../src/index.ts";

describe("sdk exports", () => {
  it("exposes EVM ABI", () => {
    expect(Array.isArray(evm.RAFFLE_ABI)).toBe(true);
    expect(evm.RAFFLE_ABI.length).toBeGreaterThan(0);
  });

  it("exposes TEE ABI", () => {
    expect(Array.isArray(tee.RAFFLE_TEE_ABI)).toBe(true);
    expect(tee.RAFFLE_TEE_ABI.length).toBeGreaterThan(0);
  });

  it("buildSlotCommitment is deterministic", () => {
    const salt = "0x" + "11".repeat(32);
    const c1 = tee.buildSlotCommitment({
      raffleId: "raffle-123",
      slotId: 1n,
      salt,
      buyer: "0x000000000000000000000000000000000000dEaD",
    });
    const c2 = tee.buildSlotCommitment({
      raffleId: "raffle-123",
      slotId: 1n,
      salt,
      buyer: "0x000000000000000000000000000000000000dEaD",
    });
    expect(c1).toBe(c2);
  });
});
