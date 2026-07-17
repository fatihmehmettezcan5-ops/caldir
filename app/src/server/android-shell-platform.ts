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
  private ctl: CaldirControlPlugin | null;
  readonly isReal: boolean;

  constructor() {
    const p = getCaldirControlPlugin();
    this.ctl = p;
    this.isReal = !!p;
  }

  private requireControlPlugin(): CaldirControlPlugin {
    if (!this.ctl) {
      throw new Error("caldir_control_unavailable");
    }
    return this.ctl;
  }

  name(): string {
    return this.isReal ? "android" : "android-stub";
  }

  async setWifi(enabled: boolean): Promise<boolean> {
    return (await this.requireControlPlugin().setWifi({ enabled })).enabled;
  }
  async setCellular(enabled: boolean): Promise<boolean> {
    return (await this.requireControlPlugin().setCellular({ enabled })).enabled;
  }
  async setBluetooth(enabled: boolean): Promise<boolean> {
    return (await this.requireControlPlugin().setBluetooth({ enabled })).enabled;
  }
  async getConnectivity(): Promise<ConnectivityState> {
    return this.requireControlPlugin().getConnectivity();
  }
  async setVolume(level: number, stream: VolumeStream): Promise<VolumeState> {
    return this.requireControlPlugin().setVolume({ level, stream });
  }
  async getVolume(stream: VolumeStream): Promise<VolumeState> {
    return this.requireControlPlugin().getVolume({ stream });
  }
  async ring(): Promise<void> {
    await this.requireControlPlugin().ring();
  }
  async lock(): Promise<void> {
    await this.requireControlPlugin().lock();
  }
  async getBattery(): Promise<BatteryInfo> {
    return this.requireControlPlugin().getBattery();
  }
  async listFiles(path: string): Promise<FileEntry[]> {
    return (await this.requireControlPlugin().listFiles({ path })).entries;
  }
  async readFile(path: string): Promise<{ name: string; data: Uint8Array }> {
    const r = await this.requireControlPlugin().readFile({ path });
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
    return this.requireControlPlugin().writeFile({ name, dataB64: b64 });
  }
  async getLocation(): Promise<LocationInfo> {
    return this.requireControlPlugin().getLocation();
  }
  async sendNotification(title: string, body: string): Promise<void> {
    await this.requireControlPlugin().sendNotification({ title, body });
  }
}
