// Çaldır platform capability interface (platform-agnostic).
//
// The Session talks to the controlled device through this abstraction. There
// are multiple implementations:
//   - NodeStubPlatform: in-memory fake for desktop dev/testing (in server/src/platforms).
//   - AndroidShellPlatform: drives real Android system APIs via Capacitor
//     plugins when running inside the APK (in app/src/server).
//   - AndroidShellPlatformStub: an in-memory stand-in used in the web preview
//     when the Capacitor runtime is not present (browser dev).

import type {
  BatteryInfo,
  ConnectivityState,
  FileEntry,
  LocationInfo,
  VolumeState,
  VolumeStream,
} from "./protocol.js";

export type {
  BatteryInfo,
  ConnectivityState,
  FileEntry,
  LocationInfo,
  VolumeState,
  VolumeStream,
};

export interface Platform {
  name(): string;
  setWifi(enabled: boolean): Promise<boolean>;
  setCellular(enabled: boolean): Promise<boolean>;
  setBluetooth(enabled: boolean): Promise<boolean>;
  getConnectivity(): Promise<ConnectivityState>;
  setVolume(level: number, stream: VolumeStream): Promise<VolumeState>;
  getVolume(stream: VolumeStream): Promise<VolumeState>;
  ring(): Promise<void>;
  lock(): Promise<void>;
  getBattery(): Promise<BatteryInfo>;
  listFiles(path: string): Promise<FileEntry[]>;
  readFile(path: string): Promise<{ name: string; data: Uint8Array }>;
  writeFile(name: string, data: Uint8Array): Promise<{ path: string }>;
  getLocation(): Promise<LocationInfo>;
  sendNotification(title: string, body: string): Promise<void>;
}
