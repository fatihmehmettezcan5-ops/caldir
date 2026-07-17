import type { BatteryInfo, ConnectivityState, FileEntry, LocationInfo, VolumeState, VolumeStream } from "./protocol.js";
export type { BatteryInfo, ConnectivityState, FileEntry, LocationInfo, VolumeState, VolumeStream, };
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
    readFile(path: string): Promise<{
        name: string;
        data: Uint8Array;
    }>;
    writeFile(name: string, data: Uint8Array): Promise<{
        path: string;
    }>;
    getLocation(): Promise<LocationInfo>;
    sendNotification(title: string, body: string): Promise<void>;
}
