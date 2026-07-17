import { useMemo } from "react";
import { getCaldirServerPlugin } from "../server/capacitor-server";
import { getCaldirControlPlugin } from "../server/capacitor-control";

interface Props {
  onPick: (role: "controller" | "controlled") => void;
}

export function RoleScreen({ onPick }: Props) {
  const controlledAvailable = useMemo(
    () => getCaldirServerPlugin() !== null && getCaldirControlPlugin() !== null,
    [],
  );

  return (
    <div className="connect-form">
      <div className="panel hero-panel">
        <div className="hero-panel-head">
          <div>
            <h2>Çaldır'ı nasıl kullanmak istiyorsun?</h2>
            <p className="small muted" style={{ marginTop: 8 }}>
              Aynı uygulama ile ister başka bir cihazı yönetebilir, ister bu
              cihazı uzaktan kontrol edilebilir hâle getirebilirsin.
            </p>
          </div>
          <span className="tag ok">Uçtan uca şifreli</span>
        </div>
      </div>

      <div className="role-grid">
        <button className="panel role-card role-card-primary" onClick={() => onPick("controller")}>
          <div className="role-badge">Kontrol Eden</div>
          <h3>Başka bir cihazı yönet</h3>
          <p>
            Diğer cihazın ekrandaki 6 haneli PIN'ini gir, güvenli oturumu kur ve
            kontrol paneline geç.
          </p>
          <div className="role-points">
            <span>• Web arayüzü ile hızlı kullanım</span>
            <span>• PIN ile kolay eşleşme</span>
            <span>• Aynı ağ zorunlu değil</span>
          </div>
        </button>

        <button
          className="panel role-card"
          disabled={!controlledAvailable}
          onClick={() => onPick("controlled")}
          title={controlledAvailable ? "" : "Bu rol yalnızca APK içinde kullanılabilir"}
        >
          <div className="role-badge secondary">Kontrol Edilen</div>
          <h3>Bu cihazı paylaş</h3>
          <p>
            Uygulama relay'e bağlanır, ekranda bir PIN gösterir ve yalnızca bu PIN
            ile gelen bağlantılara izin verir.
          </p>
          <div className="role-points">
            <span>• Kontrollü rol APK içinde çalışır</span>
            <span>• Her oturum için yeni PIN üretilebilir</span>
            <span>• Yetkisiz bağlantılar reddedilir</span>
          </div>
          {!controlledAvailable && (
            <p className="small muted" style={{ marginTop: 12 }}>
              Bu seçenek tarayıcı önizlemesinde kapalıdır. APK içinde açılır.
            </p>
          )}
        </button>
      </div>

      <div className="panel">
        <h2>Kısa özet</h2>
        <ul style={{ margin: 0, paddingLeft: 16, color: "var(--fg2)", fontSize: 13, lineHeight: 1.7 }}>
          <li>
            <b>Kontrol Eden</b>: PIN girerek diğer cihaza bağlanır ve komut gönderir.
          </li>
          <li>
            <b>Kontrol Edilen</b>: Relay'e bağlanır, PIN gösterir ve bağlantıyı kabul eder.
          </li>
          <li>
            Tüm trafik uçtan uca şifrelidir; relay yalnızca taşıyıcı görevi görür.
          </li>
        </ul>
      </div>
    </div>
  );
}
