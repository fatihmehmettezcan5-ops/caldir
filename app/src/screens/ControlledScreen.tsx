// Çaldır "kontrollü" ekranı.
// RelayHost ile public relay'e outbound bağlanır ve PIN gösterir.

import { useEffect, useState } from "react";
import { PairingManager, type PairingStore, type PeerRecord } from "@caldir/shared";
import { RelayHost } from "../server/relay-host.js";
import { AndroidShellPlatform } from "../server/android-shell-platform.js";

class MemPairingStore implements PairingStore {
  private data: PeerRecord[] = [];
  load(): PeerRecord[] { return this.data.slice(); }
  save(records: PeerRecord[]): void { this.data = records.slice(); }
}

interface Props {
  onStop: () => void;
}

// Public relay URL. Override at runtime via ?relay=... (only for debugging).
const DEFAULT_RELAY =
  (typeof URLSearchParams !== "undefined" &&
    new URLSearchParams(typeof location !== "undefined" ? location.search : "")
      .get("relay")) ||
  "wss://caldir-relay.onrender.com";

export function ControlledScreen({ onStop }: Props) {
  const [pin, setPin] = useState<string>("...");
  const [durum, setDurum] = useState<"başlıyor" | "çalışıyor" | "hata">("başlıyor");
  const [err, setErr] = useState<string | null>(null);
  const [host, setHost] = useState<RelayHost | null>(null);

  useEffect(() => {
    let iptal = false;
    let baslatilan: RelayHost | null = null;
    (async () => {
      try {
        const eslesme = new PairingManager(new MemPairingStore());
        const platform = new AndroidShellPlatform();
        const h = new RelayHost({ pairing: eslesme, platform, relayUrl: DEFAULT_RELAY });
        const r = await h.start();
        if (iptal) { await h.stop(); return; }
        baslatilan = h;
        setHost(h);
        setPin(r.pin);
        setDurum("çalışıyor");
      } catch (e) {
        if (iptal) return;
        setErr(e instanceof Error ? e.message : String(e));
        setDurum("hata");
      }
    })();
    return () => {
      iptal = true;
      if (baslatilan) { void baslatilan.stop(); }
    };
  }, []);

  async function durdur() {
    if (host) { await host.stop(); }
    onStop();
  }

  async function yeniPin() {
    if (host) { await host.stop(); }
    setDurum("başlıyor");
    setPin("...");
    setHost(null);
    try {
      const eslesme = new PairingManager(new MemPairingStore());
      const platform = new AndroidShellPlatform();
      const h = new RelayHost({ pairing: eslesme, platform, relayUrl: DEFAULT_RELAY });
      const r = await h.start();
      setHost(h);
      setPin(r.pin);
      setDurum("çalışıyor");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setDurum("hata");
    }
  }

  return (
    <div>
      <div className="panel">
        <h2>Bu cihaz kontrollü</h2>
        {durum === "başlıyor" && (
          <p className="small muted">Relay'e bağlanılıyor...</p>
        )}
        {durum === "çalışıyor" && (
          <>
            <p className="small muted" style={{ marginTop: 0 }}>
              Kontrolcü cihaza bu PIN'i gir:
            </p>
            <div className="pin-display">{pin}</div>
            <p className="small muted" style={{ marginTop: 12 }}>
              Relay adresi: <code>{DEFAULT_RELAY}</code>
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button className="btn" onClick={yeniPin} style={{ flex: 1 }}>
                Yeni PIN
              </button>
              <button className="btn danger" onClick={durdur} style={{ flex: 1 }}>
                Durdur
              </button>
            </div>
          </>
        )}
        {durum === "hata" && (
          <div className="error-banner">
            Relay'e bağlanılamadı: {err}
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Güvenlik</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Relay yalnızca iki tarafı PIN ile köprüler; tüm iletişim
          X25519 + AES-256 ile uçtan uca şifrelidir. Relay trafiği
          okuyamaz. Bağlantı outbound olduğu için hiçbir port açmaya
          gerek yoktur.
        </p>
      </div>
    </div>
  );
}
