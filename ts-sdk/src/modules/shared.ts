import { ALEO_CONFIG } from "../config.js";

export type MogatePrograms = {
  arc721Private: string;
  rafflePrivate: string;
  gateway: string;
};

export type ProgramOverrides = Partial<MogatePrograms>;

export type RaffleStatus = "OPEN" | "FILLED" | "DRAWN" | "CANCELLED" | "UNKNOWN";

export type AleoClientLike = {
  getAddress(): string;
  executeBroadcast(
    programName: string,
    functionName: string,
    inputs: string[],
    priorityFee?: number,
    privateFee?: boolean,
  ): Promise<string>;
  executeOffline(
    programName: string,
    functionName: string,
    inputs: string[],
  ): Promise<string[]>;
  getProgramMappingValue(
    programName: string,
    mappingName: string,
    key: string,
  ): Promise<string>;
  findCreditsRecord(microcredits: number): Promise<any>;
  findRecords(
    programName: string,
    recordName: string,
    maxRecords?: number,
    startHeight?: number,
    endHeight?: number,
  ): Promise<any[]>;
};

export function getPrograms(overrides?: ProgramOverrides): MogatePrograms {
  return {
    arc721Private:
      overrides?.arc721Private || ALEO_CONFIG.programs.arc721Private,
    rafflePrivate: overrides?.rafflePrivate || ALEO_CONFIG.programs.rafflePrivate,
    gateway: overrides?.gateway || ALEO_CONFIG.programs.gateway,
  };
}

export function ensureFieldSuffix(value: string): string {
  return value.endsWith("field") ? value : `${value}field`;
}

export function ensureScalarSuffix(value: string): string {
  return value.endsWith("scalar") ? value : `${value}scalar`;
}

export function formatU64Array(values: number[], length: number): string {
  const padded = Array.from({ length }, (_, i) => values[i] ?? 0);
  return `[${padded.map((n) => `${n}u64`).join(", ")}]`;
}

export function parseStructFields(raw: string): Record<string, string> {
  const trimmed = raw.trim();
  const bodyStart = trimmed.indexOf("{");
  const bodyEnd = trimmed.lastIndexOf("}");
  if (bodyStart === -1 || bodyEnd === -1) return {};

  const body = trimmed.slice(bodyStart + 1, bodyEnd);
  const matches = body.match(/\w+\s*:\s*[^,]+/g) || [];
  const fields: Record<string, string> = {};
  for (const match of matches) {
    const [key, value] = match.split(":").map((part) => part.trim());
    if (key && value) fields[key] = value;
  }
  return fields;
}

export function raffleStatusLabel(status?: string): RaffleStatus {
  switch (status) {
    case "0u8":
      return "OPEN";
    case "1u8":
      return "FILLED";
    case "2u8":
      return "DRAWN";
    case "3u8":
      return "CANCELLED";
    default:
      return "UNKNOWN";
  }
}

