// Çaldır "kontrol edilen" ekranı.
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
  const [copied, setCopied] = useState<"pin" | "relay" | null>(null);

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
    setErr(null);
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

  async function kopyala(which: "pin" | "relay") {
    const text = which === "pin" ? pin : DEFAULT_RELAY;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(which);
        setTimeout(() => setCopied(null), 1600);
      }
    } catch {
      // ignore best effort
    }
  }

  return (
    <div>
      <div className="panel hero-panel">
        <div className="hero-panel-head">
          <div>
            <h2>Bu cihaz kontrol edilmeye hazır</h2>
            <p className="small muted" style={{ marginTop: 8 }}>
              Bağlanacak kişi yalnızca bu ekrandaki PIN ile oturum açabilir.
              İstersen her bağlantı öncesi yeni PIN oluşturabilirsin.
            </p>
          </div>
          <span className="tag ok">
            {durum === "çalışıyor" ? "Hazır" : durum === "başlıyor" ? "Hazırlanıyor" : "Hata"}
          </span>
        </div>
      </div>

      <div className="panel">
        <h2>Bağlantı bilgileri</h2>
        {durum === "başlıyor" && (
          <p className="small muted">Relay bağlantısı hazırlanıyor...</p>
        )}
        {durum === "çalışıyor" && (
          <>
            <p className="small muted" style={{ marginTop: 0 }}>
              Kontrol eden tarafta aşağıdaki 6 haneli PIN'i gir.
            </p>
            <div className="pin-display">{pin}</div>
            <div className="grid2" style={{ marginTop: 10 }}>
              <button className="btn" onClick={() => void kopyala("pin")}>
                {copied === "pin" ? "PIN kopyalandı" : "PIN'i kopyala"}
              </button>
              <button className="btn" onClick={() => void kopyala("relay")}>
                {copied === "relay" ? "Adres kopyalandı" : "Relay adresini kopyala"}
              </button>
            </div>
            <p className="small muted" style={{ marginTop: 12, lineHeight: 1.7 }}>
              Relay adresi: <code>{DEFAULT_RELAY}</code>
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button className="btn" onClick={yeniPin} style={{ flex: 1 }}>
                Yeni PIN oluştur
              </button>
              <button className="btn danger" onClick={durdur} style={{ flex: 1 }}>
                Kontrollü modu kapat
              </button>
            </div>
          </>
        )}
        {durum === "hata" && (
          <div className="error-banner">
            Kontrol edilen mod başlatılamadı: {err}
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Güvenlik</h2>
        <p className="small muted" style={{ marginTop: 0, lineHeight: 1.7 }}>
          Relay yalnızca iki tarafı eşleştirir. PIN doğrulaması tamamlandıktan sonra
          trafik uçtan uca şifrelenir. Bu nedenle relay sunucusu komut içeriğini ve
          oturum verilerini okuyamaz.
        </p>
      </div>
    </div>
  );
}
