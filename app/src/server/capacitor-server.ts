// Çaldır plugin facade: server.ts
//
// Frontend-side bindings for the CaldirServer Capacitor plugin (Android).
// The Android side runs a real WebSocket server (via Java_WebSocket library)
// and relays connection lifecycle / frames to JS. This class is a thin
// portability layer; the actual protocol handshake and encryption live in
// shared.Session, which runs in JS.
//
// When running in a browser / dev (no Capacitor runtime), the factory
// `createServerHost()` returns null and the UI is expected to run in the
// controller-only role.

import {
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";

export interface ServerStartOpts {
  port: number;
}

export interface FrameEvent {
  connId: string;
  frame: string; // JSON-encoded PlainFrame
}

export interface ConnOpenEvent {
  connId: string;
  addr: string;
}

export interface ConnCloseEvent {
  connId: string;
  code: number;
  reason: string;
}

export interface FrameSendOpts {
  connId: string;
  frame: string; // JSON-encoded PlainFrame
}

export interface CaldirServerPlugin {
  start(opts: ServerStartOpts): Promise<{ port: number }>;
  stop(): Promise<void>;
  send(opts: FrameSendOpts): Promise<void>;
  closeConn(opts: { connId: string; code: number; reason: string }): Promise<void>;
  getUrl(): Promise<{ url?: string | null } | null>;

  addListener(
    event: "caldir:frame",
    listener: (e: FrameEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "caldir:connOpen",
    listener: (e: ConnOpenEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    event: "caldir:connClose",
    listener: (e: ConnCloseEvent) => void,
  ): Promise<PluginListenerHandle>;
}

let _plugin: CaldirServerPlugin | null | undefined;

export function getCaldirServerPlugin(): CaldirServerPlugin | null {
  if (_plugin !== undefined) return _plugin;
  // registerPlugin throws when Capacitor native bridge is absent (web). We
  // catch and return null so the caller can fall back to controller-only mode.
  try {
    _plugin = registerPlugin<CaldirServerPlugin>("CaldirServer");
    return _plugin;
  } catch {
    _plugin = null;
    return null;
  }
}
