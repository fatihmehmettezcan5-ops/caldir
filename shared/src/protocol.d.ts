export declare const PROTOCOL_VERSION: 1;
export type HelloMessage = {
    type: "hello";
    v: typeof PROTOCOL_VERSION;
    pub: string;
};
export type ChallengeMessage = {
    type: "challenge";
    nonce: string;
    salt: string;
};
export type PinVerifyMessage = {
    type: "pin_verify";
    pin: string;
    pub: string;
};
export type PinAckMessage = {
    type: "pin_ack";
    pub: string;
};
export type PinNackMessage = {
    type: "pin_nack";
    reason: string;
};
export type KeyExchangeMessage = {
    type: "keyx";
    pub: string;
};
export type ReadyMessage = {
    type: "ready";
};
export type ErrorMessage = {
    type: "error";
    code: string;
    message: string;
};
export type ByeMessage = {
    type: "bye";
    reason?: string;
};
export interface EncryptedPayload {
    n: string;
    c: string;
    s: number;
}
export type EncryptedFrame = {
    type: "enc";
    payload: EncryptedPayload;
};
export type PlainFrame = HelloMessage | ChallengeMessage | PinVerifyMessage | PinAckMessage | PinNackMessage | KeyExchangeMessage | ReadyMessage | ErrorMessage | ByeMessage | EncryptedFrame;
export type CommandKey = "wifi.set" | "cellular.set" | "bluetooth.set" | "volume.set" | "device.ring" | "battery.get" | "device.lock" | "file.list" | "file.download" | "file.upload" | "location.get" | "notify.send" | "ping";
export interface WifiSetArgs {
    enabled: boolean;
}
export interface CellularSetArgs {
    enabled: boolean;
}
export interface BluetoothSetArgs {
    enabled: boolean;
}
export type VolumeStream = "ring" | "media" | "alarm" | "call";
export interface VolumeSetArgs {
    level: number;
    stream: VolumeStream;
}
export interface FileListArgs {
    path: string;
}
export interface FileDownloadArgs {
    path: string;
}
export interface FileUploadArgs {
    name: string;
    size: number;
}
export interface NotifySendArgs {
    title: string;
    body: string;
}
export interface BatteryInfo {
    level: number;
    charging: boolean;
    temperatureC?: number;
}
export interface VolumeState {
    level: number;
    muted: boolean;
}
export interface ConnectivityState {
    wifi: boolean;
    cellular: boolean;
    bluetooth: boolean;
}
export interface LocationInfo {
    lat: number;
    lon: number;
    accuracyM?: number;
    ts: number;
}
export interface FileEntry {
    name: string;
    isDir: boolean;
    size: number;
}
export interface CommandRequest {
    type: "cmd";
    id: string;
    cmd: CommandKey;
    args: Record<string, unknown>;
    ts: number;
}
export interface CommandOk<T = unknown> {
    type: "ok";
    id: string;
    result: T;
}
export interface CommandErr {
    type: "err";
    id: string;
    code: string;
    message: string;
}
export type CommandResponse = CommandOk | CommandErr;
export type DeviceEventName = "battery" | "connectivity" | "volume" | "location" | "notification";
export interface DeviceEvent {
    type: "event";
    event: DeviceEventName;
    data: Record<string, unknown>;
    ts: number;
}
export type AppMessage = CommandRequest | CommandResponse | DeviceEvent;
