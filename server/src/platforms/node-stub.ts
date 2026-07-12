import type {
  BatteryInfo,
  ConnectivityState,
  FileEntry,
  LocationInfo,
  Platform,
  VolumeState,
  VolumeStream,
} from "@caldir/shared";

// In-memory platform implementation used for desktop dev/testing.
// Holds a fake device state in memory; does NOT touch any real radio.
export class NodeStubPlatform implements Platform {
  private wifi = true;
  private cellular = true;
  private bluetooth = true;
  private volumes: Record<VolumeStream, VolumeState> = {
    ring: { level: 70, muted: false },
    media: { level: 50, muted: false },
    alarm: { level: 80, muted: false },
    call: { level: 60, muted: false },
  };
  private batteryLevel = 87;
  private charging = false;

  name(): string { return "node-stub"; }

  async setWifi(enabled: boolean): Promise<boolean> { this.wifi = enabled; return this.wifi; }
  async setCellular(enabled: boolean): Promise<boolean> { this.cellular = enabled; return this.cellular; }
  async setBluetooth(enabled: boolean): Promise<boolean> { this.bluetooth = enabled; return this.bluetooth; }
  async getConnectivity(): Promise<ConnectivityState> {
    return { wifi: this.wifi, cellular: this.cellular, bluetooth: this.bluetooth };
  }
  async setVolume(level: number, stream: VolumeStream): Promise<VolumeState> {
    const clamped = Math.max(0, Math.min(100, Math.round(level)));
    const muted = clamped === 0;
    this.volumes[stream] = { level: clamped, muted };
    return this.volumes[stream];
  }
  async getVolume(stream: VolumeStream): Promise<VolumeState> { return this.volumes[stream]; }
  async ring(): Promise<void> { /* would invoke device ringtone */ }
  async lock(): Promise<void> { /* DeviceAdmin/KeyguardManager */ }
  async getBattery(): Promise<BatteryInfo> {
    return { level: this.batteryLevel, charging: this.charging };
  }
  async listFiles(_path: string): Promise<FileEntry[]> {
    return [
      { name: "Documents", isDir: true, size: 0 },
      { name: "Pictures", isDir: true, size: 0 },
      { name: "Downloads", isDir: true, size: 0 },
      { name: "README.txt", isDir: false, size: 1024 },
    ];
  }
  async readFile(path: string): Promise<{ name: string; data: Uint8Array }> {
    const text = `Çaldır stub file: ${path}\nNo real content in node-stub mode.\n`;
    return { name: path.split("/").pop() || path, data: new TextEncoder().encode(text) };
  }
  async writeFile(name: string, _data: Uint8Array): Promise<{ path: string }> {
    return { path: `/sdcard/Çaldır/${name}` };
  }
  async getLocation(): Promise<LocationInfo> {
    return { lat: 41.0082, lon: 28.9784, accuracyM: 25, ts: Date.now() };
  }
  async sendNotification(_title: string, _body: string): Promise<void> { /* system notify */ }
}
