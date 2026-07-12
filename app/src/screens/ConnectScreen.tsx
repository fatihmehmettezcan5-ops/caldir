import { useEffect, useState } from "react";
import type { CaldirClient, ConnectionState } from "../lib/client";

interface Props {
  client: CaldirClient;
  state: ConnectionState;
  error: string | null;
  onConnected: () => void;
}

const DEFAULT_PORT = 8080;

function suggestUrl(): string {
  if (typeof location === "undefined") return `ws://192.168.1.10:` + String(DEFAULT_PORT);
  const host = location.hostname;
  if (!host || host === "localhost" || host === "0.0.0.0") {
    return `ws://192.168.1.10:` + String(DEFAULT_PORT);
  }
  return "ws://" + host + ":" + String(DEFAULT_PORT);
}

export function ConnectScreen({ client, state, error, onConnected }: Props) {
  const [url, setUrl] = useState<string>(() => {
    try {
      return localStorage.getItem("caldir.url") || suggestUrl();
    } catch {
      return suggestUrl();
    }
  });
  const [pin, setPin] = useState<string>("");

  useEffect(() => {
    if (state === "ready") onConnected();
  }, [state, onConnected]);

  function baglan() {
    try {
      localStorage.setItem("caldir.url", url);
    } catch { /* ignore */ }
    client.connect(url);
  }

  function gonder() {
    if (!/^\d{6}$/.test(pin)) return;
    client.submitPin(pin);
  }

  const baglaniyor = state === "connecting" || state === "pin_sent" || state === "pin_ok" || state === "keyx_sent";
  const pinGerekli = state === "challenge" || state === "wrong_pin" || state === "pin_sent";

  return (
    <div className="connect-form">
      <div className="panel">
        <h2>Hedef cihaza bağlan</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Hedef cihazda Çaldır sunucusu açık olmalı. Aynı WiFi hotspot'a
          bağlanın. İnternet gerekmez.
        </p>
        <label className="small muted" style={{ display: "block", margin: "12px 0 6px" }}>
          Sunucu adresi (ws://)
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="ws://192.168.1.10:8080"
          spellCheck={false}
          autoComplete="off"
          disabled={state !== "disconnected" && state !== "error"}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            className="btn primary"
            onClick={baglan}
            disabled={baglaniyor || !url.trim()}
            style={{ flex: 1 }}
          >
            {baglaniyor ? "Bağlanıyor..." : "Bağlan"}
          </button>
          {state !== "disconnected" && (
            <button className="btn" onClick={() => client.disconnect()}>
              İptal
            </button>
          )}
        </div>
        {state === "disconnected" && (
          <p className="small muted" style={{ marginTop: 10 }}>
            Henüz bağlı değil. Hedef cihazın ekrandaki PIN'ini hazır edin.
          </p>
        )}
      </div>

      {pinGerekli && (
        <div className="panel">
          <h2>PIN eşleşme</h2>
          <p className="small muted" style={{ marginTop: 0 }}>
            Hedef cihazın ekranında gösterilen 6 haneli PIN'i girin.
          </p>
          <input
            type="tel"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && gonder()}
            placeholder="000000"
            maxLength={6}
            inputMode="numeric"
            autoFocus
            style={{ textAlign: "center", letterSpacing: "8px", fontSize: 24 }}
          />
          <button
            className="btn primary"
            onClick={gonder}
            disabled={pin.length !== 6 || state === "pin_sent"}
            style={{ marginTop: 12, width: "100%" }}
          >
            {state === "pin_sent" ? "Doğrulanıyor..." : "PIN ile eşleş"}
          </button>
        </div>
      )}

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <div className="panel">
        <h2>Gizlilik</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Tüm iletişim X25519 + AES-256-GCM (secretbox) ile şifrelenir.
          PIN eşleşme sırasında üretilen ortak anahtar, çevrimdışı
          saldırılarda tahmin edilemez. İnternet izni yok; hiçbir veri
          dışarı gönderilmez.
        </p>
      </div>
    </div>
  );
}