// Çaldır "kontrollü" ekranı.
// CapacitorHost ile WS sunucuyu başlatır, PIN ve adresi gösterir.

import { useEffect, useState } from "react";
import { PairingManager, type PairingStore, type PeerRecord } from "@caldir/shared";
import { CapacitorHost } from "../server/capacitor-host.js";
import { AndroidShellPlatform } from "../server/android-shell-platform.js";

class MemPairingStore implements PairingStore {
  private data: PeerRecord[] = [];
  load(): PeerRecord[] { return this.data.slice(); }
  save(records: PeerRecord[]): void { this.data = records.slice(); }
}

interface Props {
  onStop: () => void;
}

export function ControlledScreen({ onStop }: Props) {
  const [pin, setPin] = useState<string>("...");
  const [url, setUrl] = useState<string | null>(null);
  const [durum, setDurum] = useState<"başlıyor" | "çalışıyor" | "hata">("başlıyor");
  const [err, setErr] = useState<string | null>(null);
  const [host, setHost] = useState<CapacitorHost | null>(null);

  useEffect(() => {
    let iptal = false;
    let baslatilan: CapacitorHost | null = null;
    (async () => {
      try {
        const eslesme = new PairingManager(new MemPairingStore());
        const platform = new AndroidShellPlatform();
        const h = new CapacitorHost({ pairing: eslesme, platform });
        const r = await h.start();
        if (iptal) { await h.stop(); return; }
        const p = eslesme.beginPairing();
        baslatilan = h;
        if (iptal) { await h.stop(); return; }
        setHost(h);
        setPin(p);
        setUrl(r.url ?? "ws://<bu-cihaz-adresi>:" + String(r.port));
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
    setUrl(null);
    setHost(null);
    try {
      const eslesme = new PairingManager(new MemPairingStore());
      const platform = new AndroidShellPlatform();
      const h = new CapacitorHost({ pairing: eslesme, platform });
      const r = await h.start();
      setHost(h);
      setPin(eslesme.beginPairing());
      setUrl(r.url ?? "ws://<bu-cihaz-adresi>:" + String(r.port));
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
          <p className="small muted">Sunucu başlatılıyor...</p>
        )}
        {durum === "çalışıyor" && (
          <>
            <p className="small muted" style={{ marginTop: 0 }}>
              Kontrolcü cihaza bu PIN'i gir:
            </p>
            <div className="pin-display">{pin}</div>
            <p className="small muted" style={{ marginTop: 12 }}>Sunucu adresi:</p>
            <div className="pin-display" style={{ fontSize: 18, letterSpacing: 1 }}>
              {url}
            </div>
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
            Sunucu başlatılamadı: {err}
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Güvenlik</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Sunucu yalnızca yerel WiFi üzerinden dinler. İnternet izni APK'dan
          kaldırılmıştır. Her bağlanan cihaz 6 haneli PIN ile doğrulanır;
          3 yanlış denemede slot sıfırlanır. Tüm iletişim X25519 + AES-256
          ile şifrelidir.
        </p>
      </div>
    </div>
  );
}