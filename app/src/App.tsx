import { useEffect, useMemo, useState } from "react";
import { CaldirClient, type ConnectionState } from "./lib/client";
import { fallbackStateError, humanizeTransportError } from "./lib/error-messages";
import { ConnectScreen } from "./screens/ConnectScreen";
import { ControlScreen } from "./screens/ControlScreen";
import { RoleScreen } from "./screens/RoleScreen";
import { ControlledScreen } from "./screens/ControlledScreen";

const STATE_LABEL: Record<ConnectionState, string> = {
  disconnected: "Bağlı değil",
  connecting: "Bağlantı kuruluyor",
  challenge: "PIN bekleniyor",
  pin_sent: "PIN doğrulanıyor",
  pin_ok: "PIN doğrulandı",
  keyx_sent: "Güvenli oturum hazırlanıyor",
  ready: "Bağlantı hazır",
  wrong_pin: "Yanlış PIN",
  error: "Bağlantı hatası",
};

type Role = "menu" | "controller" | "controlled";

export function App() {
  const [role, setRole] = useState<Role>("menu");
  const [state, setState] = useState<ConnectionState>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const client = useMemo(
    () =>
      new CaldirClient({
        onState: setState,
        onMessage: () => {},
        onError: (e) => {
          const human = humanizeTransportError(e) ?? "Bağlantı hatası oluştu.";
          setError(human);
          setToast(human);
        },
      }),
    [],
  );

  useEffect(() => () => client.disconnect(), [client]);

  useEffect(() => {
    if (state === "disconnected") setConnected(false);
    else if (state === "ready") {
      setConnected(true);
      setError(null);
    }

    const fallback = fallbackStateError(state);
    if (fallback && !error) setError(fallback);
  }, [state, error]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  function anaMenuyeDon() {
    client.disconnect();
    setConnected(false);
    setRole("menu");
  }

  const dotClass = role === "controlled"
    ? "on"
    : state === "ready" ? "on" : state === "error" ? "err" : state === "disconnected" ? "" : "warn";
  const pillLabel =
    role === "menu" ? "Hazır"
    : role === "controlled" ? "Kontrollü"
    : STATE_LABEL[state];

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div className="logo"><span>C!</span></div>
          Çaldır!
        </div>
        <div className="conn">
          <span className="pill">
            <span className={"dot " + dotClass} />
            {pillLabel}
          </span>
        </div>
      </header>

      {role === "menu" && (
        <RoleScreen onPick={(r) => setRole(r)} />
      )}

      {role === "controlled" && (
        <ControlledScreen onStop={anaMenuyeDon} />
      )}

      {role === "controller" && (
        <>
          {!connected || state !== "ready" ? (
            <ConnectScreen
              client={client}
              state={state}
              error={error}
              onConnected={() => setConnected(true)}
            />
          ) : (
            <ControlScreen client={client} />
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="btn" onClick={() => client.disconnect()} style={{ flex: 1 }}>
              Bağlantıyı kes
            </button>
            <button className="btn" onClick={anaMenuyeDon} style={{ flex: 1 }}>
              Rol seçime dön
            </button>
          </div>
        </>
      )}

      <p className="small muted center" style={{ marginTop: 18 }}>
        Çaldır — uçtan uca şifreli bağlantı ile, aynı ağda olmasanız bile güvenli kontrol.
      </p>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}