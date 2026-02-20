import {
  type AleoClientLike,
  ensureScalarSuffix,
  getPrograms,
  type ProgramOverrides,
} from "./shared.js";

export type MintPrivateViaGatewayInput = {
  to?: string;
  nftData: string;
  nftEdition?: string;
  programs?: ProgramOverrides;
  priorityFee?: number;
  privateFee?: boolean;
};

export async function mintPrivateViaGateway(
  client: AleoClientLike,
  input: MintPrivateViaGatewayInput,
): Promise<string> {
  const programs = getPrograms(input.programs);
  const to = input.to || client.getAddress();
  const edition = ensureScalarSuffix(input.nftEdition || "1");
  return client.executeBroadcast(
    programs.gateway,
    "mint_private",
    [to, input.nftData, edition],
    input.priorityFee || 0,
    input.privateFee || false,
  );
}

// Alias for public testnet mint flow.
export async function mintFaucet(
  client: AleoClientLike,
  input: MintPrivateViaGatewayInput,
): Promise<string> {
  return mintPrivateViaGateway(client, input);
}

