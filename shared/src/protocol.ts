// Çaldır shared protocol: message types exchanged over the encrypted channel.
// Used by both the server (controlled device) and the client (controller app).

export const PROTOCOL_VERSION = 1 as const;

// ---- Wire framing ---------------------------------------------------------
// The crypto layer wraps these. Each wire frame is a JSON object with a `type`
// discriminator. We do NOT use a binary framing intentionally to keep the
// implementation auditable and simple to debug.

export type HelloMessage = { type: "hello"; v: typeof PROTOCOL_VERSION; pub: string };
export type ChallengeMessage = { type: "challenge"; nonce: string; salt: string };
export type PinVerifyMessage = { type: "pin_verify"; pin: string; pub: string };
export type PinAckMessage = { type: "pin_ack"; pub: string };
export type PinNackMessage = { type: "pin_nack"; reason: string };
export type KeyExchangeMessage = { type: "keyx"; pub: string };
export type ReadyMessage = { type: "ready" };
export type ErrorMessage = { type: "error"; code: string; message: string };
export type ByeMessage = { type: "bye"; reason?: string };

// ---- Encrypted payload (the body of an "enc" wire frame) -------------------

export interface EncryptedPayload {
  n: string; // nonce, base64 (12 bytes for AES-GCM)
  c: string; // ciphertext + tag, base64 (Web Crypto concatenates them)
  s: number; // monotonically increasing counter to defeat replay attacks
}

// A wire frame that carries encrypted application messages.
export type EncryptedFrame = { type: "enc"; payload: EncryptedPayload };

// ---- Plain (handshake) wire frames ---------------------------------------

export type PlainFrame =
  | HelloMessage
  | ChallengeMessage
  | PinVerifyMessage
  | PinAckMessage
  | PinNackMessage
  | KeyExchangeMessage
  | ReadyMessage
  | ErrorMessage
  | ByeMessage
  | EncryptedFrame;

// ---- Application-level protocol (plaintext, decrypted inside the channel) -

export type CommandKey =
  | "wifi.set" // { enabled }
  | "cellular.set" // { enabled }
  | "bluetooth.set" // { enabled }
  | "volume.set" // { level, stream }
  | "device.ring"
  | "battery.get"
  | "device.lock"
  | "file.list" // { path }
  | "file.download" // { path }
  | "file.upload" // { name, size }
  | "location.get"
  | "notify.send" // { title, body }
  | "ping";

export interface WifiSetArgs { enabled: boolean }
export interface CellularSetArgs { enabled: boolean }
export interface BluetoothSetArgs { enabled: boolean }
export type VolumeStream = "ring" | "media" | "alarm" | "call";
export interface VolumeSetArgs { level: number; stream: VolumeStream }
export interface FileListArgs { path: string }
export interface FileDownloadArgs { path: string }
export interface FileUploadArgs { name: string; size: number }
export interface NotifySendArgs { title: string; body: string }

// ---- Command result shapes (shared between client & platform) --------------

export interface BatteryInfo {
  level: number; // 0..100
  charging: boolean;
  temperatureC?: number;
}

export interface VolumeState {
  level: number; // 0..100 per stream
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
  id: string; // client-generated request id
  cmd: CommandKey;
  args: Record<string, unknown>;
  ts: number;
}

export interface CommandOk<T = unknown> { type: "ok"; id: string; result: T }
export interface CommandErr { type: "err"; id: string; code: string; message: string }
export type CommandResponse = CommandOk | CommandErr;

export type DeviceEventName =
  | "battery"
  | "connectivity"
  | "volume"
  | "location"
  | "notification";

export interface DeviceEvent {
  type: "event";
  event: DeviceEventName;
  data: Record<string, unknown>;
  ts: number;
}

export type AppMessage = CommandRequest | CommandResponse | DeviceEvent;
