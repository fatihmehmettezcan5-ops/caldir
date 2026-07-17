// Caldir e2e smoke test.
//
// Boots an in-process secure WebSocket server using NodeStubPlatform and a
// fresh PairingManager, then drives a from-scratch client through the full
// handshake and a couple of encrypted commands. Pass = exit 0. Any throw =
// non-zero exit.
//
// This is an end-to-end proof that the server and an independent client
// implementation agree on the protocol.

import WebSocket, { type MessageEvent } from "ws";
import nacl from "tweetnacl";
import {
  deriveSessionKey,
  deterministicSalt,
  fromBase64,
  toBase64,
  newKeyPair,
  hashPin,
  seal,
  open,
  PROTOCOL_VERSION,
  type CommandResponse,
  type PlainFrame,
  type KeyPair,
  PairingManager,
  type PairingStore,
  type PeerRecord,
} from "@caldir/shared";
import { startSecureServer, NodeStubPlatform } from "@caldir/server";

// In-memory PairingStore for the test.
class MemPairingStore implements PairingStore {
  private data: PeerRecord[] = [];
  load(): PeerRecord[] { return this.data.slice(); }
  save(records: PeerRecord[]): void { this.data = records.slice(); }
}

interface TestCtx {
  url: string;
  pin: string;
  close: () => void;
  mintPin: () => string;
}

function bootServer(): TestCtx {
  const platform = new NodeStubPlatform();
  const pairing = new PairingManager(new MemPairingStore());
  const pin = pairing.beginPairing();
  const port = 18080 + Math.floor(Math.random() * 1000);
  const server = startSecureServer({ host: "127.0.0.1", port, platform, pairing });
  return {
    url: `ws://127.0.0.1:${port}`,
    pin,
    close: () => server.close(),
    mintPin: () => pairing.beginPairing(),
  };
}

class SmokeClient {
  private ws: WebSocket;
  private keys: KeyPair = newKeyPair();
  private salt: Uint8Array | null = null;
  private pairingSecret: Uint8Array | null = null;
  private serverPub: Uint8Array | null = null;
  private sessionKey: Uint8Array | null = null;
  private sendSeq = 0;
  private recvSeq = 0;
  readonly ready: Promise<void>;
  private resolveReady!: () => void;
  private rejectReady!: (e: Error) => void;

  constructor(url: string, private pin: string) {
    this.ready = new Promise<void>((res, rej) => {
      this.resolveReady = res;
      this.rejectReady = rej;
    });
    this.ws = new WebSocket(url, "caldir.v1");
    this.ws.binaryType = "arraybuffer";
    this.ws.onopen = () => this.send({ type: "hello", v: PROTOCOL_VERSION, pub: toBase64(this.keys.publicKey) });
    this.ws.onmessage = (ev) => this.onMessage(ev);
    this.ws.onclose = () => this.rejectReady(new Error("socket_closed"));
    this.ws.onerror = () => this.rejectReady(new Error("socket_error"));
  }

  private send(frame: PlainFrame) {
    this.ws.send(JSON.stringify(frame));
  }

  private onMessage(ev: MessageEvent) {
    if (typeof ev.data !== "string") return;
    let frame: PlainFrame;
    try { frame = JSON.parse(ev.data) as PlainFrame; } catch { return; }
    switch (frame.type) {
      case "challenge":
        this.salt = fromBase64(frame.salt);
        // Derive the local pairing secret from the pin and salt.
        this.pairingSecret = hashPin(this.pin, this.salt, 5000);
        // Send pin_verify with our ephemeral pubkey.
        this.send({ type: "pin_verify", pin: this.pin, pub: toBase64(this.keys.publicKey) });
        break;
      case "pin_ack": {
        let sp: Uint8Array;
        try { sp = fromBase64(frame.pub); if (sp.length !== 32) throw new Error(); } catch {
          this.rejectReady(new Error("bad pin_ack")); return;
        }
        this.serverPub = sp;
        this.send({ type: "keyx", pub: toBase64(this.keys.publicKey) });
        break;
      }
      case "pin_nack":
        this.rejectReady(new Error("pin_nack: " + frame.reason));
        break;
      case "keyx": {
        // We already have serverPub from pin_ack. Derive session key.
        let sp: Uint8Array;
        try { sp = fromBase64(frame.pub); if (sp.length !== 32) throw new Error(); } catch {
          this.rejectReady(new Error("bad keyx")); return;
        }
        if (this.serverPub && !equalBytes(this.serverPub, sp)) {
          this.rejectReady(new Error("keyx switch")); return;
        }
        this.serverPub = sp;
        if (!this.pairingSecret) { this.rejectReady(new Error("no secret")); return; }
        const shared = nacl.box.before(sp, this.keys.secretKey);
        const salt = deterministicSalt(sp, this.keys.publicKey);
        this.sessionKey = deriveSessionKey(shared, this.pairingSecret, salt);
        // Server will send `ready`.
        break;
      }
      case "ready":
        this.resolveReady();
        break;
      case "error":
        if (!this.sessionKey) this.rejectReady(new Error("server_error: " + frame.code));
        else console.error("server error:", frame.code, frame.message);
        break;
      case "enc":
        this.onEnc(frame.payload);
        break;
      default:
        break;
    }
  }

  private onEnc(payload: { n: string; c: string; s: number }) {
    if (!this.sessionKey) return;
    if (payload.s <= this.recvSeq) return;
    const json = open(this.sessionKey, payload, this.recvSeq);
    this.recvSeq = payload.s;
    const res = JSON.parse(json) as CommandResponse;
    // Resolve the in-flight promise.
    const p = this.pending.get(res.id);
    if (p) {
      this.pending.delete(res.id);
      p(res);
    }
  }

  private pending = new Map<string, (r: CommandResponse) => void>();

  async cmd(cmd: string, args: Record<string, unknown>, timeoutMs = 8000): Promise<CommandResponse> {
    if (!this.sessionKey) throw new Error("not_ready");
    const id = Math.random().toString(36).slice(2, 10);
    const req = { type: "cmd" as const, id, cmd, args, ts: Date.now() };
    const seq = this.sendSeq + 1;
    this.sendSeq = seq;
    const locked = seal(this.sessionKey, seq, JSON.stringify(req));
    return new Promise<CommandResponse>((resolve, reject) => {
      this.pending.set(id, resolve);
      this.send({ type: "enc", payload: locked });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("timeout"));
        }
      }, timeoutMs);
    });
  }

  close() { try { this.ws.close(); } catch { /* ignore */ } }
}

async function main() {
  const ctx = bootServer();
  let ok = true;
  try {
    const client = new SmokeClient(ctx.url, ctx.pin);
    await client.ready;
    console.log("  [OK] handshake -> ready");

    const ping = await client.cmd("ping", {});
    if (ping.type !== "ok") throw new Error("ping not ok");
    console.log("  [OK] ping ->", JSON.stringify(ping.result));

    const battery = await client.cmd("battery.get", {});
    if (battery.type !== "ok") throw new Error("battery.get not ok");
    const b = battery.result as { level: number; charging: boolean };
    if (typeof b.level !== "number") throw new Error("battery.get bad result");
    console.log("  [OK] battery.get ->", JSON.stringify(b));

    const wifi = await client.cmd("wifi.set", { enabled: false });
    if (wifi.type !== "ok") throw new Error("wifi.set not ok");
    console.log("  [OK] wifi.set false ->", JSON.stringify(wifi.result));

    // Negative: wrong pin should fail fast. Mint a fresh pairing slot
    // because the previous one was consumed by the successful session.
    const freshPin = ctx.mintPin();
    // Build a guaranteed-wrong pin: keep length 6 but change one digit.
    const wrongPin: string = (Number(freshPin) === 0 ? "111111" : "000000").slice(0, 6);
    const negClient = new SmokeClient(ctx.url, wrongPin);
    try {
      await negClient.ready;
      throw new Error("wrong_pin_should_have_failed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/pin_nack|no_pairing/.test(msg)) throw e;
      console.log("  [OK] wrong pin rejected");
    } finally {
      negClient.close();
    }

    client.close();
  } catch (e) {
    ok = false;
    console.error("  [FAIL]", e instanceof Error ? e.message : String(e));
  } finally {
    ctx.close();
  }
  if (!ok) process.exitCode = 1;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

void main();
