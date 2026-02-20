import {
  type AleoClientLike,
  ensureFieldSuffix,
  getPrograms,
  parseStructFields,
  raffleStatusLabel,
  type RaffleStatus,
  type ProgramOverrides,
} from "./shared.js";

export type RaffleDetailResult = {
  raffleId: string;
  raw: string;
  fields: Record<string, string>;
  status: RaffleStatus;
};

export async function getRaffleDetail(
  client: AleoClientLike,
  raffleIdInput: string,
  programs?: ProgramOverrides,
): Promise<RaffleDetailResult> {
  const ids = getPrograms(programs);
  const raffleId = ensureFieldSuffix(raffleIdInput);
  const raw = await client.getProgramMappingValue(
    ids.rafflePrivate,
    "raffles",
    raffleId,
  );
  const fields = parseStructFields(raw);
  return {
    raffleId,
    raw,
    fields,
    status: raffleStatusLabel(fields.status),
  };
}

export type RaffleSlotsResult = {
  raffleId: string;
  totalSlots: number;
  taken: number[];
  available: number[];
};

// RPC/mapping-based slot view (Solana-like read path), no view transition required.
export async function getRaffleSlots(
  client: AleoClientLike,
  raffleIdInput: string,
  totalSlotsInput?: number,
  programs?: ProgramOverrides,
): Promise<RaffleSlotsResult> {
  const ids = getPrograms(programs);
  const raffleId = ensureFieldSuffix(raffleIdInput);

  let totalSlots = totalSlotsInput || 0;
  if (!totalSlots) {
    const detail = await getRaffleDetail(client, raffleId, ids);
    totalSlots = Number((detail.fields.total_slots || "0u64").replace("u64", ""));
  }
  if (!totalSlots) throw new Error("Unable to determine total slots");

  const taken: number[] = [];
  const available: number[] = [];

  for (let slot = 1; slot <= totalSlots; slot += 1) {
    const [slotKey] = await client.executeOffline(
      ids.rafflePrivate,
      "compute_slot_key_hash",
      [raffleId, `${slot}u64`],
    );
    try {
      const value = await client.getProgramMappingValue(
        ids.rafflePrivate,
        "slot_taken",
        slotKey,
      );
      if (value === "true") {
        taken.push(slot);
      } else {
        available.push(slot);
      }
    } catch {
      available.push(slot);
    }
  }

  return { raffleId, totalSlots, taken, available };
}

export type TicketSummary = {
  raw: string;
  raffleId?: string;
  slots: number[];
};

function extractField(raw: string, key: string): string | undefined {
  const regex = new RegExp(`${key}\\s*:\\s*([^,}]+)`);
  const match = raw.match(regex);
  return match ? match[1].trim() : undefined;
}

function extractSlots(raw: string): number[] {
  const match = raw.match(/slots\s*:\s*\[([^\]]+)\]/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((v) => v.trim())
    .map((v) => Number(v.replace("u64", "")))
    .filter((v) => Number.isFinite(v) && v > 0);
}

export type UserTicketsResult = {
  raffleIds: string[];
  tickets: TicketSummary[];
};

export type GetUserTicketsInput = {
  raffleId?: string;
  maxRecords?: number;
  startHeight?: number;
  endHeight?: number;
  programs?: ProgramOverrides;
};

export async function getUserTickets(
  client: AleoClientLike,
  input: GetUserTicketsInput = {},
): Promise<UserTicketsResult> {
  const ids = getPrograms(input.programs);
  const records = await client.findRecords(
    ids.rafflePrivate,
    "TicketBatch",
    input.maxRecords ?? 50,
    input.startHeight ?? 0,
    input.endHeight,
  );

  const raffleIds = new Set<string>();
  const tickets: TicketSummary[] = [];

  for (const record of records) {
    const raw = typeof record?.toString === "function"
      ? record.toString()
      : String(record);
    const raffleId = extractField(raw, "raffle_id");
    if (raffleId) raffleIds.add(raffleId);

    if (!input.raffleId || input.raffleId === raffleId) {
      tickets.push({
        raw,
        raffleId,
        slots: extractSlots(raw),
      });
    }
  }

  return {
    raffleIds: Array.from(raffleIds),
    tickets,
  };
}
