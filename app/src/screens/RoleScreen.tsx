import { useMemo } from "react";
import { getCaldirServerPlugin } from "../server/capacitor-server";

interface Props {
  onPick: (role: "controller" | "controlled") => void;
}

export function RoleScreen({ onPick }: Props) {
  const serverAvailable = useMemo(() => getCaldirServerPlugin() !== null, []);
  return (
    <div className="connect-form">
      <div className="panel">
        <h2>Rol seç</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Çaldır iki rolden birinde çalışır. Aynı cihaz istersen iki rolü de
          sırayla kullanabilirsin.
        </p>

        <button
          className="btn primary"
          style={{ width: "100%", marginTop: 6 }}
          onClick={() => onPick("controller")}
        >
          Kontrolcü &gt; bu cihaz başkasını kontrol eder
        </button>

        <button
          className="btn"
          style={{ width: "100%", marginTop: 10 }}
          disabled={!serverAvailable}
          onClick={() => onPick("controlled")}
          title={serverAvailable ? "" : "Bu rol yalnızca APK'da açık"}
        >
          Kontrollü &gt; başkaları bunu kontrol eder
          {!serverAvailable && (
            <span className="small muted" style={{ marginLeft: 6 }}>
              (APK gerekir)
            </span>
          )}
        </button>
      </div>

      <div className="panel">
        <h2>Ne fark var?</h2>
        <ul style={{ margin: 0, paddingLeft: 16, color: "var(--fg2)", fontSize: 13 }}>
          <li>
            <b>Kontrolcü</b>: Bir başka cihazın ekranındaki PIN'i ve
            ws:// adresini girersin, onu kontrol edersin.
          </li>
          <li>
            <b>Kontrollü</b>: Bu cihaz bir WS sunucu açar; ekranda bir
            PIN ve adres gösterir. Bağlanmasına izin verirsin.
          </li>
        </ul>
      </div>
    </div>
  );
}