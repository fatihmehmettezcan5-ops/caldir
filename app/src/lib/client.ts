// Çaldır client: a thin façade over the encrypted Transport that exposes
// typed control-panel operations. The UI talks to this object.
//
// Each method corresponds to a CommandKey in the shared protocol. The methods
// return Promise<CommandOk['result']> and throw on CommandErr.

import { Transport, type ConnectionState, type TransportEvents } from "./transport";
import type {
  CommandResponse,
  BatteryInfo,
  VolumeState,
  VolumeStream,
  FileEntry,
  LocationInfo,
} from "@caldir/shared";

// Re-export for convenience.
export type { ConnectionState };
export type { TransportEvents };

export interface ClientCallbacks {
  onState: (s: ConnectionState) => void;
  onMessage?: (m: unknown) => void;
  onError?: (e: string) => void;
}

export class CaldirClient {
  private tx: Transport;

  constructor(cb: ClientCallbacks) {
    this.tx = new Transport({
      onState: cb.onState,
      onMessage: (m) => cb.onMessage?.(m),
      onError: cb.onError,
    });
  }

  get state(): ConnectionState {
    return this.tx.status;
  }
  get isReady(): boolean {
    return this.tx.isReady;
  }

  connect(url: string) {
    this.tx.connect(url);
  }
  connectRelay(relayUrl: string, pin: string) {
    this.tx.connectRelay(relayUrl, pin);
  }
  disconnect() {
    this.tx.disconnect();
  }
  submitPin(pin: string) {
    this.tx.submitPin(pin);
  }

  async wifiSet(enabled: boolean): Promise<boolean> {
    const r = await this.tx.sendCommand("wifi.set", { enabled });
    return unwrap<boolean>(r, "enabled");
  }

  async cellularSet(enabled: boolean): Promise<boolean> {
    const r = await this.tx.sendCommand("cellular.set", { enabled });
    return unwrap<boolean>(r, "enabled");
  }

  async bluetoothSet(enabled: boolean): Promise<boolean> {
    const r = await this.tx.sendCommand("bluetooth.set", { enabled });
    return unwrap<boolean>(r, "enabled");
  }

  async setVolume(level: number, stream: VolumeStream): Promise<VolumeState> {
    const r = await this.tx.sendCommand("volume.set", { level, stream });
    return obj<VolumeState>(r);
  }

  async ring(): Promise<void> {
    await this.tx.sendCommand("device.ring", {});
  }

  async getBattery(): Promise<BatteryInfo> {
    const r = await this.tx.sendCommand("battery.get", {});
    return obj<BatteryInfo>(r);
  }

  async lock(): Promise<void> {
    await this.tx.sendCommand("device.lock", {});
  }

  async listFiles(path: string): Promise<FileEntry[]> {
    const r = await this.tx.sendCommand("file.list", { path });
    return obj<FileEntry[]>(r);
  }

  async downloadFile(path: string): Promise<{ name: string; data: Uint8Array }> {
    const r = await this.tx.sendCommand("file.download", { path });
    return obj<{ name: string; data: Uint8Array }>(r);
  }

  async uploadFile(name: string, size: number): Promise<{ path: string }> {
    const r = await this.tx.sendCommand("file.upload", { name, size });
    return obj<{ path: string }>(r);
  }

  async getLocation(): Promise<LocationInfo> {
    const r = await this.tx.sendCommand("location.get", {});
    return obj<LocationInfo>(r);
  }

  async notify(title: string, body: string): Promise<void> {
    await this.tx.sendCommand("notify.send", { title, body });
  }

  async ping(): Promise<number> {
    const r = await this.tx.sendCommand("ping", {});
    const v = obj<{ pong: number }>(r);
    return v.pong;
  }
}

function unwrap<T>(r: CommandResponse, key: string): T {
  if (r.type === "err") throw new Error(`${r.code}: ${r.message}`);
  const result = r.result as Record<string, unknown>;
  return result[key] as T;
}

function obj<T>(r: CommandResponse): T {
  if (r.type === "err") throw new Error(`${r.code}: ${r.message}`);
  return r.result as T;
}
