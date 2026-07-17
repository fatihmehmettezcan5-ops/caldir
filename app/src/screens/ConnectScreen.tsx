import { useEffect, useMemo, useState } from "react";
import { humanizeTransportError } from "../lib/error-messages";
import type { CaldirClient, ConnectionState } from "../lib/client";

interface Props {
  client: CaldirClient;
  state: ConnectionState;
  error: string | null;
  onConnected: () => void;
}

const RELAY_STORAGE_KEY = "caldir.relayUrl";
const DEFAULT_RELAY =
  (typeof URLSearchParams !== "undefined" &&
    new URLSearchParams(typeof location !== "undefined" ? location.search : "")
      .get("relay")) ||
  (typeof localStorage !== "undefined" && localStorage.getItem(RELAY_STORAGE_KEY)) ||
  "wss://caldir-relay.onrender.com";

export function ConnectScreen({ client, state, error, onConnected }: Props) {
  const [pin, setPin] = useState<string>("");
  const [relayUrl, setRelayUrl] = useState<string>(DEFAULT_RELAY);
  const [localError, setLocalError] = useState<string | null>(null);

  const visibleError = useMemo(
    () => localError ?? humanizeTransportError(error),
    [localError, error],
  );

  useEffect(() => {
    if (state === "ready") {
      onConnected();
      setLocalError(null);
      try { localStorage.setItem(RELAY_STORAGE_KEY, relayUrl.trim()); } catch { /* ignore */ }
    }
  }, [state, onConnected, relayUrl]);

  function validateRelayUrl(input: string): string | null {
    try {
      const url = new URL(input.trim());
      if (url.protocol !== "wss:" && url.protocol !== "ws:") {
        return "Relay adresi ws:// veya wss:// ile başlamalı.";
      }
      return null;
    } catch {
      return "Relay adresi geçerli bir WebSocket adresi olmalı.";
    }
  }

  function baglan() {
    if (!/^\d{6}$/.test(pin)) {
      setLocalError("PIN yalnızca 6 haneli rakamlardan oluşmalıdır.");
      return;
    }
    const relayErr = validateRelayUrl(relayUrl);
    if (relayErr) {
      setLocalError(relayErr);
      return;
    }
    setLocalError(null);
    client.connectRelay(relayUrl.trim(), pin);
  }

  const baglaniyor =
    state === "connecting" ||
    state === "pin_sent" ||
    state === "pin_ok" ||
    state === "keyx_sent";

  return (
    <div className="connect-form">
      <div className="panel hero-panel">
        <div className="hero-panel-head">
          <div>
            <h2>Kontrol edilen cihaza bağlan</h2>
            <p className="small muted" style={{ marginTop: 8 }}>
              Hedef cihazda Çaldır'ı açıp <b>Kontrol Edilen</b> rolünü seç.
              Ekranda görünen 6 haneli PIN'i aşağıya girerek güvenli oturumu başlat.
            </p>
          </div>
          <span className="tag ok">PIN ile eşleşme</span>
        </div>
      </div>

      <div className="panel">
        <h2>Bağlantı bilgileri</h2>
        <label className="small muted" style={{ display: "block", margin: "12px 0 6px" }}>
          Relay adresi
        </label>
        <input
          type="text"
          value={relayUrl}
          onChange={(e) => {
            setRelayUrl(e.target.value);
            if (localError) setLocalError(null);
          }}
          spellCheck={false}
          autoComplete="off"
          placeholder="wss://ornek-relay.com"
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setRelayUrl(DEFAULT_RELAY);
              setLocalError(null);
            }}
            style={{ flex: 1 }}
          >
            Varsayılan relay adresini kullan
          </button>
        </div>

        <label className="small muted" style={{ display: "block", margin: "14px 0 6px" }}>
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
          className="pin-input"
        />

        <button
          className="btn primary"
          onClick={baglan}
          disabled={baglaniyor || pin.length !== 6}
          style={{ marginTop: 12, width: "100%" }}
        >
          {baglaniyor ? "Bağlantı kuruluyor..." : "PIN ile bağlan"}
        </button>

        {state === "disconnected" && pin.length === 6 && (
          <p className="small muted" style={{ marginTop: 10 }}>
            PIN hazır. Bağlantıyı başlatmak için düğmeye bas.
          </p>
        )}

        {state !== "disconnected" && state !== "error" && (
          <button
            className="btn"
            onClick={() => client.disconnect()}
            style={{ marginTop: 10, width: "100%" }}
          >
            Bağlantıyı iptal et
          </button>
        )}
      </div>

      {visibleError && (
        <div className="error-banner">
          {visibleError}
        </div>
      )}

      <div className="panel">
        <h2>Gizlilik ve güvenlik</h2>
        <p className="small muted" style={{ marginTop: 0, lineHeight: 1.7 }}>
          Tüm iletişim uçtan uca şifrelenir. Relay yalnızca iki tarafı
          eşleştirir; gönderilen komutları ve içerikleri düz metin olarak göremez.
          Aynı ağda olmanız gerekmez.
        </p>
      </div>
    </div>
  );
}
