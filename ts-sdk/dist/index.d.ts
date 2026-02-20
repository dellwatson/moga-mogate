declare class AleoNFTClient {
    private account;
    private networkClient;
    private programManager;
    private keyProvider;
    private recordProvider;
    constructor(privateKey?: string);
    getAddress(): string;
    getBalance(): Promise<number>;
    execute(programName: string, functionName: string, inputs: string[], fee?: number): Promise<string>;
    executeBroadcast(programName: string, functionName: string, inputs: string[], priorityFee?: number, privateFee?: boolean): Promise<string>;
    executeOffline(programName: string, functionName: string, inputs: string[]): Promise<string[]>;
    deploy(programPath: string, fee?: number): Promise<string>;
    getProgramMappingValue(programName: string, mappingName: string, key: string): Promise<string>;
    getProgramSource(programName: string): Promise<string>;
    getProgramImports(programName: string): Promise<any>;
    findCreditsRecord(microcredits: number): Promise<any>;
    mintAuthority(toAddress: string, uriHash: string, tokenId: string): Promise<string>;
    mintFaucet(toAddress: string, uriHash: string): Promise<string>;
    mintDirect(toAddress: string, uriHash: string): Promise<string>;
    initializeGateway(ownerAddress: string): Promise<string>;
    getTransaction(txId: string): Promise<any>;
    findRecords(programName: string, recordName: string, maxRecords?: number, startHeight?: number, endHeight?: number): Promise<any[]>;
}
declare function createClient(privateKey?: string): AleoNFTClient;

declare const ALEO_CONFIG: {
    readonly network: "testnet";
    readonly endpoint: "https://api.provable.com/v2";
    readonly programs: {
        readonly arc721Private: "mogate_arc721_private.aleo";
        readonly rafflePrivate: "mogate_darkpool_raffle_private.aleo";
        readonly gateway: "mogate_authority_mint_v3.aleo";
        readonly collection: {
            readonly v1: "mogate_nft_collection_rwa.aleo";
            readonly v2: "mogate_nft_collection_rwa_v2.aleo";
        };
        readonly gatewayLegacy: {
            readonly v1: "mogate_authority_mint_gateway.aleo";
            readonly v2: "mogate_authority_mint_v2.aleo";
            readonly v3: "mogate_authority_mint_v3.aleo";
        };
    };
    readonly deployments: {
        readonly collection_v1: {
            readonly programName: "mogate_nft_collection_rwa.aleo";
            readonly transactionId: "at1as952eycv6h7ypdph0rj8tfzr0c89arg7gtsyztsr8x08n9hkc9sf62wjd";
            readonly status: "deployed";
        };
        readonly collection_v2: {
            readonly programName: "mogate_nft_collection_rwa_v2.aleo";
            readonly status: "pending";
        };
        readonly gateway_v2: {
            readonly programName: "mogate_authority_mint_v2.aleo";
            readonly transactionId: "at1h5uauul7hvn63qpka495vxtpglgvfjkp4y5eh06cdwqwtrznwv8qrkl2uj";
            readonly status: "deployed";
        };
    };
};
declare function getPrivateKey(): string;
declare function getProgramPath(program: "collection" | "gateway" | "arc721Private" | "rafflePrivate"): string;

type MogatePrograms = {
    arc721Private: string;
    rafflePrivate: string;
    gateway: string;
};
type ProgramOverrides = Partial<MogatePrograms>;
type RaffleStatus = "OPEN" | "FILLED" | "DRAWN" | "CANCELLED" | "UNKNOWN";
type AleoClientLike = {
    getAddress(): string;
    executeBroadcast(programName: string, functionName: string, inputs: string[], priorityFee?: number, privateFee?: boolean): Promise<string>;
    executeOffline(programName: string, functionName: string, inputs: string[]): Promise<string[]>;
    getProgramMappingValue(programName: string, mappingName: string, key: string): Promise<string>;
    findCreditsRecord(microcredits: number): Promise<any>;
    findRecords(programName: string, recordName: string, maxRecords?: number, startHeight?: number, endHeight?: number): Promise<any[]>;
};
declare function getPrograms(overrides?: ProgramOverrides): MogatePrograms;
declare function ensureFieldSuffix(value: string): string;
declare function ensureScalarSuffix(value: string): string;
declare function formatU64Array(values: number[], length: number): string;
declare function parseStructFields(raw: string): Record<string, string>;
declare function raffleStatusLabel(status?: string): RaffleStatus;

type MintPrivateViaGatewayInput = {
    to?: string;
    nftData: string;
    nftEdition?: string;
    programs?: ProgramOverrides;
    priorityFee?: number;
    privateFee?: boolean;
};
declare function mintPrivateViaGateway(client: AleoClientLike, input: MintPrivateViaGatewayInput): Promise<string>;
declare function mintFaucet(client: AleoClientLike, input: MintPrivateViaGatewayInput): Promise<string>;

type InitializeRaffleInput = {
    admin?: string;
    backend?: string;
    treasury?: string;
    programs?: ProgramOverrides;
    priorityFee?: number;
    privateFee?: boolean;
};
declare function initializeRafflePrivate(client: AleoClientLike, input?: InitializeRaffleInput): Promise<string>;
type HostRaffleUnsafeInput = {
    raffleId: string;
    totalSlots: number;
    maxSlotsPerAddress?: number;
    metadataHash?: string;
    seed: number;
    nftData: string;
    nftEdition?: string;
    autoDraw?: boolean;
    autoClaim?: boolean;
    programs?: ProgramOverrides;
    priorityFee?: number;
    privateFee?: boolean;
};
type HostRaffleUnsafeResult = {
    txId: string;
    raffleId: string;
    seedCommit: string;
    prizeCommit: string;
};
declare function hostRaffleUnsafe(client: AleoClientLike, input: HostRaffleUnsafeInput): Promise<HostRaffleUnsafeResult>;
type JoinRaffleUnsafeInput = {
    raffleId: string;
    slots: number[];
    priceMicroPerSlot?: number;
    priceCreditsPerSlot?: number;
    amountMicro?: number;
    paymentRecord?: string;
    programs?: ProgramOverrides;
    priorityFee?: number;
    privateFee?: boolean;
};
type JoinRaffleUnsafeResult = {
    txId: string;
    amountMicro: number;
    raffleId: string;
    slots: number[];
};
declare function joinRaffleUnsafe(client: AleoClientLike, input: JoinRaffleUnsafeInput): Promise<JoinRaffleUnsafeResult>;
type DrawRaffleInput = {
    raffleId: string;
    seed: number;
    programs?: ProgramOverrides;
    priorityFee?: number;
    privateFee?: boolean;
};
declare function drawRaffle(client: AleoClientLike, input: DrawRaffleInput): Promise<string>;
type ClaimRafflePrizeInput = {
    ticketRecord: string;
    slotId: number;
    nftData: string;
    nftEdition?: string;
    programs?: ProgramOverrides;
    priorityFee?: number;
    privateFee?: boolean;
};
declare function claimRafflePrize(client: AleoClientLike, input: ClaimRafflePrizeInput): Promise<string>;

type RaffleDetailResult = {
    raffleId: string;
    raw: string;
    fields: Record<string, string>;
    status: RaffleStatus;
};
declare function getRaffleDetail(client: AleoClientLike, raffleIdInput: string, programs?: ProgramOverrides): Promise<RaffleDetailResult>;
type RaffleSlotsResult = {
    raffleId: string;
    totalSlots: number;
    taken: number[];
    available: number[];
};
declare function getRaffleSlots(client: AleoClientLike, raffleIdInput: string, totalSlotsInput?: number, programs?: ProgramOverrides): Promise<RaffleSlotsResult>;
type TicketSummary = {
    raw: string;
    raffleId?: string;
    slots: number[];
};
type UserTicketsResult = {
    raffleIds: string[];
    tickets: TicketSummary[];
};
type GetUserTicketsInput = {
    raffleId?: string;
    maxRecords?: number;
    startHeight?: number;
    endHeight?: number;
    programs?: ProgramOverrides;
};
declare function getUserTickets(client: AleoClientLike, input?: GetUserTicketsInput): Promise<UserTicketsResult>;

export { ALEO_CONFIG, type AleoClientLike, AleoNFTClient, type ClaimRafflePrizeInput, type DrawRaffleInput, type GetUserTicketsInput, type HostRaffleUnsafeInput, type HostRaffleUnsafeResult, type InitializeRaffleInput, type JoinRaffleUnsafeInput, type JoinRaffleUnsafeResult, type MintPrivateViaGatewayInput, type MogatePrograms, type ProgramOverrides, type RaffleDetailResult, type RaffleSlotsResult, type RaffleStatus, type TicketSummary, type UserTicketsResult, claimRafflePrize, createClient, drawRaffle, ensureFieldSuffix, ensureScalarSuffix, formatU64Array, getPrivateKey, getProgramPath, getPrograms, getRaffleDetail, getRaffleSlots, getUserTickets, hostRaffleUnsafe, initializeRafflePrivate, joinRaffleUnsafe, mintFaucet, mintPrivateViaGateway, parseStructFields, raffleStatusLabel };
