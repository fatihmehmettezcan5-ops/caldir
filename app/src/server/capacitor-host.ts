// Çaldır Capacitor server host.
//
// Glues the CaldirServer Capacitor plugin (Android WebSocket server) to the
// platform-agnostic shared.Session / PairingManager so the full controlled
// role can run inside the APK in JavaScript. The Android side relays only
// raw `PlainFrame` strings - everything else (handshake, encryption, command
// dispatch) is handled by shared code.
//
// Lifecycle:
//   const host = new CapacitorHost({ pairing, platform });
//   await host.start();               // starts WS server on Android
//   // host takes care of incoming connections & message dispatch.
//   await host.stop();

import {
  PairingManager,
  Session,
  type PlainFrame,
  type Platform,
} from "@caldir/shared";
import {
  getCaldirServerPlugin,
  type CaldirServerPlugin,
  type FrameEvent,
  type ConnOpenEvent,
  type ConnCloseEvent,
} from "./capacitor-server.js";
import type { PluginListenerHandle } from "@capacitor/core";

export interface CapacitorHostOpts {
  pairing: PairingManager;
  platform: Platform;
  port?: number;
}

export interface StartResult {
  url: string | null;
  port: number;
}

export class CapacitorHost {
  private plugin: CaldirServerPlugin;
  private pairing: PairingManager;
  private platform: Platform;
  private sessions = new Map<string, Session>();
  private handles: PluginListenerHandle[] = [];

  constructor(opts: CapacitorHostOpts) {
    const p = getCaldirServerPlugin();
    if (!p) throw new Error("caldir_server_unavailable");
    this.plugin = p;
    this.pairing = opts.pairing;
    this.platform = opts.platform;
  }

  async start(): Promise<StartResult> {
    const port = (await this.plugin.start({ port: 8080 })).port;
    // Bind event listeners (frames + conn lifecycle).
    const h1 = await this.plugin.addListener("caldir:connOpen", (e: ConnOpenEvent) =>
      this.onConnOpen(e),
    );
    const h2 = await this.plugin.addListener("caldir:connClose", (e: ConnCloseEvent) =>
      this.onConnClose(e),
    );
    const h3 = await this.plugin.addListener("caldir:frame", (e: FrameEvent) =>
      this.onFrame(e),
    );
    this.handles.push(h1, h2, h3);

    const urlRes = await safeGetUrl(this.plugin);
    if (urlRes) {
      return { url: urlRes.url, port };
    }
    return { url: null, port };
  }

  async stop(): Promise<void> {
    for (const h of this.handles) {
      try { await h.remove(); } catch { /* ignore */ }
    }
    this.handles = [];
    this.sessions.clear();
    await this.plugin.stop();
  }

  private onConnOpen(e: ConnOpenEvent) {
    const connId = e.connId;
    const session = new Session({
      id: connId,
      platform: this.platform,
      pairing: this.pairing,
      send: (frame: PlainFrame) => {
        void this.plugin.send({ connId, frame: JSON.stringify(frame) });
      },
    });
    this.sessions.set(connId, session);
  }

  private onConnClose(e: ConnCloseEvent) {
    this.sessions.delete(e.connId);
  }

  private onFrame(e: FrameEvent) {
    const session = this.sessions.get(e.connId);
    if (!session) return;
    let frame: PlainFrame;
    try { frame = JSON.parse(e.frame) as PlainFrame; } catch { return; }
    session.handleFrame(frame).catch((err) => {
      const message = err instanceof Error ? err.message : "internal";
      void this.plugin.send({
        connId: e.connId,
        frame: JSON.stringify({ type: "error", code: "internal", message }),
      });
    });
  }
}

async function safeGetUrl(p: CaldirServerPlugin): Promise<{ url: string } | null> {
  try {
    const value = await p.getUrl();
    return value && typeof value.url === "string" && value.url.length > 0
      ? { url: value.url }
      : null;
  } catch {
    return null;
  }
}
