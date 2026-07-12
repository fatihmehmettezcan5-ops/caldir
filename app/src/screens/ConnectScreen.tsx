import { useEffect, useState } from "react";
import type { CaldirClient, ConnectionState } from "../lib/client";

interface Props {
  client: CaldirClient;
  state: ConnectionState;
  error: string | null;
  onConnected: () => void;
}

const DEFAULT_RELAY =
  (typeof URLSearchParams !== "undefined" &&
    new URLSearchParams(typeof location !== "undefined" ? location.search : "")
      .get("relay")) ||
  "wss://caldir-relay.onrender.com";

export function ConnectScreen({ client, state, error, onConnected }: Props) {
  const [pin, setPin] = useState<string>("");

  useEffect(() => {
    if (state === "ready") onConnected();
  }, [state, onConnected]);

  function baglan() {
    if (!/^\d{6}$/.test(pin)) return;
    client.connectRelay(DEFAULT_RELAY, pin);
  }

  const baglaniyor =
    state === "connecting" ||
    state === "pin_sent" ||
    state === "pin_ok" ||
    state === "keyx_sent";

  return (
    <div className="connect-form">
      <div className="panel">
        <h2>Hedef cihaza bağlan</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Hedef cihazda Çaldır'ı açın ve <b>Kontrollü</b> rolünü seçin.
          Ekranda 6 haneli bir PIN görünecek; buraya girin. Aynı ağda
          olmaya gerek yok — relay üzerinden uçtan uca şifreli köprü
          kurulur.
        </p>
        <label className="small muted" style={{ display: "block", margin: "12px 0 6px" }}>
          Relay adresi
        </label>
        <input
          type="text"
          value={DEFAULT_RELAY}
          readOnly
          spellCheck={false}
          autoComplete="off"
          style={{ opacity: 0.7 }}
        />
        <label className="small muted" style={{ display: "block", margin: "12px 0 6px" }}>
          Hedef cihazın PIN'i
        </label>
        <input
          type="tel"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && baglan()}
          placeholder="000000"
          maxLength={6}
          inputMode="numeric"
          autoFocus
          style={{ textAlign: "center", letterSpacing: "8px", fontSize: 24 }}
        />
        <button
          className="btn primary"
          onClick={baglan}
          disabled={baglaniyor || pin.length !== 6}
          style={{ marginTop: 12, width: "100%" }}
        >
          {baglaniyor ? "Bağlanıyor..." : "PIN ile bağlan"}
        </button>
        {state === "disconnected" && pin.length === 6 && (
          <p className="small muted" style={{ marginTop: 10 }}>
            PIN girildi. "Bağlan" tuşuna basın.
          </p>
        )}
        {state !== "disconnected" && state !== "error" && (
          <button
            className="btn"
            onClick={() => client.disconnect()}
            style={{ marginTop: 10, width: "100%" }}
          >
            İptal
          </button>
        )}
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <div className="panel">
        <h2>Gizlilik</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Tüm iletişim X25519 + AES-256-GCM (secretbox) ile şifrelenir.
          Relay yalnızca iki tarafı PIN ile eşleştirir; trafik şifreli
          olduğundan relay içeriği göremez. İnternet izni APK'da yok;
          hiçbir veri üçüncü tarafa gönderilmez.
        </p>
      </div>
    </div>
  );
}
