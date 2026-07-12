// Çaldır control panel - encrypted transport client.
//
// Drives the same handshake as the server using @caldir/shared primitives:
//   hello            -> challenge {nonce, salt}
//   pin_verify       -> pin_ack | pin_nack
//   keyx             -> keyx (both sides send their ephemeral pubkey)
//   ready            -> enc frames from now on
//
// Security highlights:
//   - The salt is published by the server in the clear. That's safe: an
//     attacker who intercepts the salt still cannot derive the pairingSecret
//     without knowing the PIN, and cannot derive the session key without the
//     ECDH shared secret.
//   - The client derives `pairingSecret` independently from the PIN + salt,
//     the same way the server does, so both sides get identical bytes.
//   - The HKDF salt for deriveSessionKey is a deterministic hash of both
//     ephemeral public keys, so no extra round-trip is needed and the
//     session is bound to the specific key exchange.

import nacl from "tweetnacl";
import {
  PROTOCOL_VERSION,
  type PlainFrame,
  type CommandRequest,
  type CommandResponse,
  type CommandKey,
  type AppMessage,
  deriveSessionKey,
  deterministicSalt,
  hashPin,
  fromBase64,
  toBase64,
  newKeyPair,
  seal,
  open,
  type KeyPair,
} from "@caldir/shared";

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "challenge" // waiting for user PIN entry
  | "pin_sent"
  | "pin_ok"
  | "keyx_sent"
  | "ready"
  | "wrong_pin"
  | "error";

export interface TransportEvents {
  onState: (s: ConnectionState) => void;
  onMessage?: (m: AppMessage) => void;
  onError?: (e: string) => void;
}

interface PendingResponse {
  id: string;
  resolve: (r: CommandResponse) => void;
}

export class Transport {
  private ws: WebSocket | null = null;
  private state: ConnectionState = "disconnected";
  private clientKeys: KeyPair | null = null;
  private serverPub: Uint8Array | null = null;
  private salt: Uint8Array | null = null;
  private pairingSecret: Uint8Array | null = null;
  private sessionKey: Uint8Array | null = null;
  private sendSeq = 0;
  private recvSeq = 0;
  private pendingRes = new Map<string, PendingResponse>();
  readonly events: TransportEvents;

  constructor(events: TransportEvents) {
    this.events = events;
  }

  private setState(s: ConnectionState) {
    this.state = s;
    this.events.onState(s);
  }

  get status(): ConnectionState {
    return this.state;
  }
  get isReady(): boolean {
    return this.state === "ready" && this.sessionKey !== null;
  }

  connect(url: string) {
    this.disconnect();
    this.clientKeys = newKeyPair();
    this.setState("connecting");
    let ws: WebSocket;
    try {
      ws = new WebSocket(url, "caldir.v1");
    } catch {
      this.setState("error");
      return;
    }
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    ws.onopen = () => {
      this.send({
        type: "hello",
        v: PROTOCOL_VERSION,
        pub: toBase64(this.clientKeys!.publicKey),
      });
    };
    ws.onmessage = (ev) => this.onMessage(ev);
    ws.onclose = () => {
      this.ws = null;
      this.setState("disconnected");
    };
    ws.onerror = () => {
      this.events.onError?.("ws_error");
      this.setState("error");
    };
  }

  // Connect through the public relay using a 6-digit PIN. The relay URL must
  // already include the pin/role query parameters. After the relay bridge is
  // established we send the standard Çaldır `hello` frame which the host side
  // (the controlled device) will see unchanged.
  connectRelay(relayUrl: string, pin: string) {
    this.disconnect();
    this.clientKeys = newKeyPair();
    this.setState("connecting");
    const url = `${relayUrl}/?pin=${encodeURIComponent(pin)}&role=guest`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url, "caldir-relay.v1");
    } catch {
      this.setState("error");
      return;
    }
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    ws.onopen = () => {
      // Give the host a moment to arrive; the relay silently drops frames
      // until both peers are connected so the hello may need to be retried.
      this.send({
        type: "hello",
        v: PROTOCOL_VERSION,
        pub: toBase64(this.clientKeys!.publicKey),
      });
    };
    ws.onmessage = (ev) => this.onMessage(ev);
    ws.onclose = () => {
      this.ws = null;
      this.setState("disconnected");
    };
    ws.onerror = () => {
      this.events.onError?.("relay_error");
      this.setState("error");
    };
  }

  disconnect() {
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) this.send({ type: "bye" });
        this.ws.close();
      } catch { /* ignore */ }
    }
    this.ws = null;
    this.clientKeys = null;
    this.serverPub = null;
    this.salt = null;
    this.pairingSecret = null;
    this.sessionKey = null;
    this.sendSeq = 0;
    this.recvSeq = 0;
    this.pendingRes.clear();
    this.setState("disconnected");
  }

  // Submit the 6-digit PIN. Derives the local pairing secret from the pin
  // and the salt received in the challenge, then sends pin_verify.
  submitPin(pin: string) {
    if (!this.clientKeys || !this.salt) return;
    if (!/^\d{6}$/.test(pin)) {
      this.events.onError?.("bad_pin_format");
      return;
    }
    this.pairingSecret = hashPin(pin, this.salt, 5000);
    this.send({
      type: "pin_verify",
      pin,
      pub: toBase64(this.clientKeys.publicKey),
    });
    this.setState("pin_sent");
  }

  private send(frame: PlainFrame) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
    }
  }

  private onMessage(ev: MessageEvent) {
    if (typeof ev.data !== "string") return;
    let frame: PlainFrame;
    try {
      frame = JSON.parse(ev.data) as PlainFrame;
    } catch {
      return;
    }
    switch (frame.type) {
      case "challenge":
        this.handleChallenge(frame);
        break;
      case "pin_ack":
        this.handlePinAck(frame);
        break;
      case "pin_nack":
        this.handlePinNack(frame);
        break;
      case "keyx":
        this.handleKeyx(frame);
        break;
      case "ready":
        if (this.state === "keyx_sent") this.setState("ready");
        break;
      case "enc":
        this.handleEncrypted(frame.payload);
        break;
      case "error":
        this.events.onError?.(`${frame.code}: ${frame.message}`);
        if (frame.code === "decrypt" || frame.code === "replay") {
          this.setState("error");
        }
        break;
      case "bye":
        this.disconnect();
        break;
      default:
        break;
    }
  }

  private handleChallenge(frame: PlainFrame & { type: "challenge" }) {
    this.salt = fromBase64(frame.salt);
    // UI now prompts for the 6-digit PIN displayed on the controlled device.
    this.setState("challenge");
  }

  private handlePinAck(frame: PlainFrame & { type: "pin_ack" }) {
    // Store the server's ephemeral public key.
    try {
      const sp = fromBase64(frame.pub);
      if (sp.length !== 32) throw new Error("bad");
      this.serverPub = sp;
    } catch {
      this.setState("error");
      return;
    }
    // Advance: send our keyx. (Server echoes its pubkey in keyx too, but our
    // derivation only needs the value we already have from pin_ack.)
    this.send({ type: "keyx", pub: toBase64(this.clientKeys!.publicKey) });
    this.setState("keyx_sent");
  }

  private handlePinNack(frame: PlainFrame & { type: "pin_nack" }) {
    this.pairingSecret = null;
    this.setState("wrong_pin");
    // Allow retry; surface a state machines back to challenge after UI acts.
    this.events.onError?.(`pin_nack: ${frame.reason}`);
    this.setState("challenge");
  }

  private handleKeyx(frame: PlainFrame & { type: "keyx" }) {
    if (!this.clientKeys || !this.pairingSecret) {
      this.setState("error");
      return;
    }
    let sp: Uint8Array;
    try {
      sp = fromBase64(frame.pub);
      if (sp.length !== 32) throw new Error("bad");
    } catch {
      this.setState("error");
      return;
    }
    // If we already stored a server pub from pin_ack, ensure consistency.
    if (this.serverPub) {
      let ok = true;
      if (this.serverPub.length !== sp.length) ok = false;
      else for (let i = 0; i < sp.length; i++) if (sp[i] !== this.serverPub[i]) ok = false;
      if (!ok) {
        this.setState("error");
        return;
      }
    } else {
      this.serverPub = sp;
    }
    const shared = nacl.box.before(sp, this.clientKeys.secretKey);
    const salt = deterministicSalt(sp, this.clientKeys.publicKey);
    this.sessionKey = deriveSessionKey(shared, this.pairingSecret, salt);
    // `ready` frame from server will flip state to "ready".
  }

  // Encrypt and send a command, returning a promise for the response.
  sendCommand<C extends CommandKey>(
    cmd: C,
    args: Record<string, unknown>,
  ): Promise<CommandResponse> {
    return new Promise((resolve, reject) => {
      if (!this.isReady || !this.sessionKey) {
        reject(new Error("not_ready"));
        return;
      }
      const id = Math.random().toString(36).slice(2, 12);
      const req: CommandRequest = {
        type: "cmd",
        id,
        cmd,
        args,
        ts: Date.now(),
      };
      const seq = this.sendSeq + 1;
      this.sendSeq = seq;
      const locked = seal(this.sessionKey, seq, JSON.stringify(req));
      this.pendingRes.set(id, { id, resolve });
      this.send({ type: "enc", payload: locked });
      // Defensive timeout so a dropped response doesn't leak the pending slot.
      setTimeout(() => {
        if (this.pendingRes.has(id)) {
          this.pendingRes.delete(id);
          reject(new Error("timeout"));
        }
      }, 15_000);
    });
  }

  private handleEncrypted(payload: { n: string; c: string; s: number }) {
    if (!this.sessionKey) return;
    if (payload.s <= this.recvSeq) {
      this.events.onError?.("replay");
      return;
    }
    let json: string;
    try {
      json = open(this.sessionKey, payload, this.recvSeq);
      this.recvSeq = payload.s;
    } catch {
      this.events.onError?.("decrypt_failed");
      return;
    }
    let msg: AppMessage;
    try {
      msg = JSON.parse(json);
    } catch {
      return;
    }
    if ((msg.type === "ok" || msg.type === "err") && msg.id) {
      const p = this.pendingRes.get(msg.id);
      if (p) {
        this.pendingRes.delete(msg.id);
        p.resolve(msg);
        return;
      }
    }
    this.events.onMessage?.(msg);
  }
}
