export interface PeerRecord {
    clientId: string;
    label?: string;
    pub: string;
    salt: string;
    verifier: string;
    createdAt: number;
    lastSeen: number;
}
export interface PairingStore {
    load(): PeerRecord[];
    save(records: PeerRecord[]): void;
}
export declare class PairingManager {
    private store;
    private peers;
    private pending;
    constructor(store: PairingStore);
    reload(): void;
    beginPairing(): string;
    cancelPairing(): void;
    verifyPin(candidate: string): boolean;
    consumePending(): {
        pairingSecret: Uint8Array;
        salt: Uint8Array;
    } | null;
    getPendingNonce(): Uint8Array | null;
    getPendingSalt(): Uint8Array | null;
    registerPeer(input: {
        pub: string;
        pin?: string;
        label?: string;
    }): PeerRecord;
    removePeer(clientId: string): void;
    listPeers(): PeerRecord[];
    private persist;
}
