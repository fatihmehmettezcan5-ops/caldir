// Node pairing store: file-backed PairingStore for the desktop server.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { PairingStore, PeerRecord } from "@caldir/shared";

export class FsPairingStore implements PairingStore {
  private storePath: string;
  constructor(storePath?: string) {
    const dir = process.env.CALDIR_HOME || join(homedir(), ".caldir");
    this.storePath = storePath ?? join(dir, "peers.json");
  }
  load(): PeerRecord[] {
    try {
      if (existsSync(this.storePath)) {
        const raw = readFileSync(this.storePath, "utf8");
        const arr: PeerRecord[] = JSON.parse(raw);
        return arr;
      }
    } catch { /* ignore corrupt store */ }
    return [];
  }
  save(records: PeerRecord[]): void {
    try {
      mkdirSync(join(this.storePath, ".."), { recursive: true });
      writeFileSync(this.storePath, JSON.stringify(records, null, 2), "utf8");
    } catch { /* best-effort */ }
  }
}