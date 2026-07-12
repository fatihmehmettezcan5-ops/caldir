// Çaldır pairing manager (platform-agnostic).
//
// Pure logic; persistence is delegated to an injected PairingStore. This lets
// the same code run both on Node (fs-backed store) and inside the Android
// Capacitor WebView (memory store or a Capacitor-Preferences-backed store).
//
// Security properties preserved from the Node-only original:
//   - PIN is never stored (only verifier = hashPin(pin, salt)).
//   - 3 wrong attempts cancel the pending slot; 5-min TTL.
//   - Constant-time pin comparison.

import {
  constantTimeEqual,
  hashPin,
  randomBytes,
  toBase64,
} from "./crypto.js";

export interface PeerRecord {
  clientId: string;
  label?: string;
  pub: string;
  salt: string;
  verifier: string;
  createdAt: number;
  lastSeen: number;
}

// Platform-injected persistence. The store is opaque to the manager; it must
// atomically replace the whole peer list.
export interface PairingStore {
  load(): PeerRecord[];
  save(records: PeerRecord[]): void;
}

interface PendingSlot {
  salt: Uint8Array;
  nonce: Uint8Array;
  verifier: Uint8Array;
  pairingSecret: Uint8Array;
  createdAt: number;
  attempts: number;
  expiresAt: number;
}

const MAX_PIN_ATTEMPTS = 3;
const PIN_TTL_MS = 5 * 60 * 1000;

export class PairingManager {
  private store: PairingStore;
  private peers = new Map<string, PeerRecord>();
  private pending: PendingSlot | null = null;

  constructor(store: PairingStore) {
    this.store = store;
    this.reload();
  }

  reload() {
    this.peers.clear();
    for (const p of this.store.load()) this.peers.set(p.clientId, p);
  }

  // Begin a new pairing. Returns the 6-digit PIN to display on the device.
  beginPairing(): string {
    const pin = generatePinString();
    const salt = randomBytes(16);
    const nonce = randomBytes(16);
    const verifier = hashPin(pin, salt, 1000);
    const pairingSecret = hashPin(pin, salt, 5000);
    this.pending = {
      salt,
      nonce,
      verifier,
      pairingSecret,
      createdAt: Date.now(),
      attempts: 0,
      expiresAt: Date.now() + PIN_TTL_MS,
    };
    return pin;
  }

  cancelPairing() {
    this.pending = null;
  }

  verifyPin(candidate: string): boolean {
    const p = this.pending;
    if (!p) return false;
    if (Date.now() > p.expiresAt) {
      this.pending = null;
      return false;
    }
    if (!/^\d{6}$/.test(candidate)) return false;
    const calc = hashPin(candidate, p.salt, 1000);
    const ok = constantTimeEqual(calc, p.verifier);
    if (!ok) {
      p.attempts += 1;
      if (p.attempts >= MAX_PIN_ATTEMPTS) this.pending = null;
    }
    return ok;
  }

  consumePending(): { pairingSecret: Uint8Array; salt: Uint8Array } | null {
    const p = this.pending;
    if (!p) return null;
    if (Date.now() > p.expiresAt) {
      this.pending = null;
      return null;
    }
    this.pending = null;
    return { pairingSecret: p.pairingSecret, salt: p.salt };
  }

  getPendingNonce(): Uint8Array | null {
    return this.pending?.nonce ?? null;
  }
  getPendingSalt(): Uint8Array | null {
    return this.pending?.salt ?? null;
  }

  registerPeer(input: { pub: string; pin?: string; label?: string }): PeerRecord {
    const clientId = toBase64(randomBytes(16));
    const salt = randomBytes(16);
    const rec: PeerRecord = {
      clientId,
      label: input.label,
      pub: input.pub,
      salt: toBase64(salt),
      verifier: input.pin ? toBase64(hashPin(input.pin, salt, 1000)) : "",
      createdAt: Date.now(),
      lastSeen: Date.now(),
    };
    this.peers.set(clientId, rec);
    this.persist();
    return rec;
  }

  removePeer(clientId: string) {
    this.peers.delete(clientId);
    this.persist();
  }

  listPeers(): PeerRecord[] {
    return Array.from(this.peers.values());
  }

  private persist() {
    try {
      this.store.save(Array.from(this.peers.values()));
    } catch {
      // best-effort
    }
  }
}

function generatePinString(): string {
  const b = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) {
    const d = i === 0 ? 1 + (b[i] % 9) : b[i] % 10;
    out += d.toString();
  }
  return out;
}
