// Çaldır Android shell platform.
//
// Implements the shared.Platform interface by forwarding to the CaldirControl
// Capacitor plugin. Falls back to NodeStubPlatform behaviour when the plugin
// is unavailable (browser/preview), so the panel can still be exercised
// against a desktop Node server for testing.

import {
  type BatteryInfo,
  type ConnectivityState,
  type FileEntry,
  type LocationInfo,
  type Platform,
  type VolumeState,
  type VolumeStream,
} from "@caldir/shared";
import {
  getCaldirControlPlugin,
  type CaldirControlPlugin,
} from "./capacitor-control.js";

export class AndroidShellPlatform implements Platform {
  private ctl: CaldirControlPlugin;
  readonly isReal: boolean;

  constructor() {
    const p = getCaldirControlPlugin();
    this.ctl = p as CaldirControlPlugin;
    this.isReal = !!p;
  }

  name(): string {
    return this.isReal ? "android" : "android-stub";
  }

  async setWifi(enabled: boolean): Promise<boolean> {
    return (await this.ctl.setWifi({ enabled })).enabled;
  }
  async setCellular(enabled: boolean): Promise<boolean> {
    return (await this.ctl.setCellular({ enabled })).enabled;
  }
  async setBluetooth(enabled: boolean): Promise<boolean> {
    return (await this.ctl.setBluetooth({ enabled })).enabled;
  }
  async getConnectivity(): Promise<ConnectivityState> {
    return this.ctl.getConnectivity();
  }
  async setVolume(level: number, stream: VolumeStream): Promise<VolumeState> {
    return this.ctl.setVolume({ level, stream });
  }
  async getVolume(stream: VolumeStream): Promise<VolumeState> {
    return this.ctl.getVolume({ stream });
  }
  async ring(): Promise<void> {
    await this.ctl.ring();
  }
  async lock(): Promise<void> {
    await this.ctl.lock();
  }
  async getBattery(): Promise<BatteryInfo> {
    return this.ctl.getBattery();
  }
  async listFiles(path: string): Promise<FileEntry[]> {
    return (await this.ctl.listFiles({ path })).entries;
  }
  async readFile(path: string): Promise<{ name: string; data: Uint8Array }> {
    const r = await this.ctl.readFile({ path });
    // base64 -> bytes
    const bin = atob(r.dataB64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { name: r.name, data: bytes };
  }
  async writeFile(name: string, data: Uint8Array): Promise<{ path: string }> {
    // bytes -> base64
    let bin = "";
    for (let i = 0; i < data.length; i++) bin += String.fromCharCode(data[i]);
    const b64 = btoa(bin);
    return this.ctl.writeFile({ name, dataB64: b64 });
  }
  async getLocation(): Promise<LocationInfo> {
    return this.ctl.getLocation();
  }
  async sendNotification(title: string, body: string): Promise<void> {
    await this.ctl.sendNotification({ title, body });
  }
}
