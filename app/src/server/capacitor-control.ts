// Çaldır plugin facade: control.ts
//
// Frontend-side bindings for the CaldirControl Capacitor plugin (Android).
// Each method maps to an Android system API call guarded by a runtime
// permission check. The plugin is best-effort: a method returns a status
// object describing what happened (e.g. wifi: true/false, error codes) rather
// than throw where the Android side still recovered.

import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface BoolResult { enabled: boolean }
export interface VolumeResult { level: number; muted: boolean }
export interface BatteryResult { level: number; charging: boolean; temperatureC?: number }
export interface ConnectivityResult { wifi: boolean; cellular: boolean; bluetooth: boolean }
export interface LocationResult { lat: number; lon: number; accuracyM?: number; ts: number }
export interface FileEntryResult { name: string; isDir: boolean; size: number }
export interface FileListResult { entries: FileEntryResult[]; path: string }
export interface FileReadResult { name: string; dataB64: string }
export interface FileWriteResult { path: string }

export interface CaldirControlPlugin {
  setWifi(opts: { enabled: boolean }): Promise<BoolResult>;
  setCellular(opts: { enabled: boolean }): Promise<BoolResult>;
  setBluetooth(opts: { enabled: boolean }): Promise<BoolResult>;
  getConnectivity(): Promise<ConnectivityResult>;
  setVolume(opts: { level: number; stream: string }): Promise<VolumeResult>;
  getVolume(opts: { stream: string }): Promise<VolumeResult>;
  ring(): Promise<{ ok: true }>;
  lock(): Promise<{ ok: true }>;
  getBattery(): Promise<BatteryResult>;
  listFiles(opts: { path: string }): Promise<FileListResult>;
  readFile(opts: { path: string }): Promise<FileReadResult>;
  writeFile(opts: { name: string; dataB64: string }): Promise<FileWriteResult>;
  getLocation(): Promise<LocationResult>;
  sendNotification(opts: { title: string; body: string }): Promise<{ ok: true }>;
  // Listener: low-battery event pushed by Android when battery <= 15%.
  addListener(
    event: "caldir:batteryLow",
    listener: (e: BatteryResult) => void,
  ): Promise<PluginListenerHandle>;
}

let _plugin: CaldirControlPlugin | null | undefined;

export function getCaldirControlPlugin(): CaldirControlPlugin | null {
  if (_plugin !== undefined) return _plugin;
  try {
    _plugin = registerPlugin<CaldirControlPlugin>("CaldirControl");
    return _plugin;
  } catch {
    _plugin = null;
    return null;
  }
}
