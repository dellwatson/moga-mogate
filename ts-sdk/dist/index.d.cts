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
    deploy(programPath: string, fee?: number): Promise<string>;
    mintAuthority(toAddress: string, uriHash: string, tokenId: string): Promise<string>;
    mintFaucet(toAddress: string, uriHash: string): Promise<string>;
    mintDirect(toAddress: string, uriHash: string): Promise<string>;
    initializeGateway(ownerAddress: string): Promise<string>;
    getTransaction(txId: string): Promise<any>;
}
declare function createClient(privateKey?: string): AleoNFTClient;

declare const ALEO_CONFIG: {
    readonly network: "testnet";
    readonly endpoint: "https://api.provable.com/v2";
    readonly programs: {
        readonly collection: {
            readonly v1: "mogate_nft_collection_rwa.aleo";
            readonly v2: "mogate_nft_collection_rwa_v2.aleo";
        };
        readonly gateway: {
            readonly v1: "mogate_authority_mint_gateway.aleo";
            readonly v2: "mogate_authority_mint_v2.aleo";
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
declare function getProgramPath(program: "collection" | "gateway"): string;

export { ALEO_CONFIG, AleoNFTClient, createClient, getPrivateKey, getProgramPath };
