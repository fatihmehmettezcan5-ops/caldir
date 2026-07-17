export declare const toBase64: (bytes: Uint8Array) => string;
export declare const fromBase64: (s: string) => Uint8Array;
export declare const randomBytes: (n: number) => Uint8Array;
export declare const constantTimeEqual: (a: Uint8Array, b: Uint8Array) => boolean;
export interface KeyPair {
    secretKey: Uint8Array;
    publicKey: Uint8Array;
}
export declare const newKeyPair: () => KeyPair;
export declare const deriveSessionKey: (sharedSecret: Uint8Array, pairingSecret: Uint8Array, salt: Uint8Array) => Uint8Array;
export interface LockedPayload {
    n: string;
    c: string;
    s: number;
}
export declare const seal: (sessionKey: Uint8Array, seq: number, json: string) => LockedPayload;
export declare const open: (sessionKey: Uint8Array, locked: LockedPayload, lastReceivedSeq: number) => string;
export declare const hashPin: (pin: string, salt: Uint8Array, iterations?: number) => Uint8Array;
export declare const generatePin: () => string;
export declare const hmacChallenge: (pairingSecret: Uint8Array, nonce: Uint8Array) => Uint8Array;
export declare const deterministicSalt: (serverPub: Uint8Array, clientPub: Uint8Array) => Uint8Array;
export declare const verifyChallenge: (pairingSecret: Uint8Array, nonce: Uint8Array, proof: Uint8Array) => boolean;
