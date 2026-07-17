import { type PlainFrame, type AppMessage } from "./index.js";
import { PairingManager } from "./pairing.js";
import type { Platform } from "./platform.js";
type SendFn = (frame: PlainFrame) => void;
export declare class Session {
    readonly id: string;
    private readonly platform;
    private readonly pairing;
    private readonly send;
    private hs;
    private sessionKey;
    constructor(opts: {
        id: string;
        platform: Platform;
        pairing: PairingManager;
        send: SendFn;
    });
    handleFrame(frame: PlainFrame): Promise<void>;
    private handleHello;
    private handlePinVerify;
    private handleKeyx;
    private handleEncrypted;
    private sendEncrypted;
    sendEvent(event: AppMessage & {
        type: "event";
    }): void;
    get isReady(): boolean;
}
export {};
