import { useEffect, useState } from "react";
import type { CaldirClient } from "../lib/client";
import type {
  BatteryInfo,
  VolumeState,
  VolumeStream,
  FileEntry,
  LocationInfo,
} from "@caldir/shared";

interface Props {
  client: CaldirClient;
}

function humanizePanelError(error: unknown): string {
  const msg = error instanceof Error ? error.message : "Beklenmeyen hata";
  if (msg.includes("cellular_unsupported")) return "Mobil ağ bu cihazda uygulama tarafından değiştirilemiyor.";
  if (msg.includes("device_admin_required")) return "Ekran kilidi için cihaz yöneticisi yetkisi gerekiyor.";
  if (msg.includes("location_permission_required")) return "Konum izni verilmeden bu bilgi alınamaz.";
  if (msg.includes("location_unavailable")) return "Konum şu anda alınamadı.";
  if (msg.includes("notification_permission_required")) return "Bildirim göndermek için izin gerekiyor.";
  if (msg.includes("bluetooth_permission_required")) return "Bluetooth izni verilmeden işlem yapılamaz.";
  if (msg.includes("file_not_found")) return "İstenen dosya bulunamadı.";
  return msg;
}

export function ControlScreen({ client }: Props) {
  return (
    <>
      <div className="panel hero-panel dashboard-hero">
        <div className="hero-panel-head">
          <div>
            <div className="eyebrow">Uzak kontrol paneli</div>
            <h2 className="hero-title">Bağlantı kuruldu, cihaz yönetimine hazırsın</h2>
            <p className="panel-lead">
              Aşağıdaki kartlardan bağlantıları, sesi, pili, cihaz işlemlerini ve
              diğer uzaktan komutları güvenli oturum üzerinden yönetebilirsin.
            </p>
          </div>
          <span className="tag ok">Şifreli oturum açık</span>
        </div>
        <div className="feature-pills">
          <span className="tag">Bağlantılar</span>
          <span className="tag">Ses</span>
          <span className="tag">Pil</span>
          <span className="tag">Konum</span>
          <span className="tag">Dosyalar</span>
          <span className="tag">Bildirim</span>
        </div>
      </div>

      <div className="section-grid">
        <ConnectivityPanel client={client} />
        <VolumePanel client={client} />
        <BatteryPanel client={client} />
        <DevicePanel client={client} />
        <LocationPanel client={client} />
        <NotifyPanel client={client} />
      </div>

      <FilesPanel client={client} />
    </>
  );
}

function PanelHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="panel-heading">
      <h2>{title}</h2>
      <p className="panel-subtitle">{subtitle}</p>
    </div>
  );
}

function ConnectivityPanel({ client }: { client: CaldirClient }) {
  const [wifi, setWifi] = useState<boolean | null>(null);
  const [cell, setCell] = useState<boolean | null>(null);
  const [bt, setBt] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function toggle(which: "wifi" | "cell" | "bt", val: boolean) {
    try {
      setErr(null);
      setBusy(which);
      if (which === "wifi") { await client.wifiSet(val); setWifi(val); }
      else if (which === "cell") { await client.cellularSet(val); setCell(val); }
      else { await client.bluetoothSet(val); setBt(val); }
    } catch (e) {
      setErr(humanizePanelError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel feature-panel">
      <PanelHeading
        title="Bağlantı ayarları"
        subtitle="Wi‑Fi, mobil ağ ve Bluetooth durumunu uzaktan yönetebilirsin."
      />
      <div className="row">
        <div className="label">
          <span className="k">Wi‑Fi</span>
          <span className="v">{wifi == null ? "durum alınmadı" : wifi ? "açık" : "kapalı"}</span>
        </div>
        <div className={"switch" + (wifi === true ? " on" : "")}
          onClick={() => busy == null && void toggle("wifi", wifi !== true)} aria-label="Wi‑Fi">
        </div>
      </div>
      <div className="row">
        <div className="label">
          <span className="k">Mobil ağ</span>
          <span className="v">{cell == null ? "durum alınmadı" : cell ? "açık" : "kapalı"}</span>
        </div>
        <div className={"switch" + (cell === true ? " on" : "")}
          onClick={() => busy == null && void toggle("cell", cell !== true)} aria-label="Mobil ağ">
        </div>
      </div>
      <div className="row">
        <div className="label">
          <span className="k">Bluetooth</span>
          <span className="v">{bt == null ? "durum alınmadı" : bt ? "açık" : "kapalı"}</span>
        </div>
        <div className={"switch" + (bt === true ? " on" : "")}
          onClick={() => busy == null && void toggle("bt", bt !== true)} aria-label="Bluetooth">
        </div>
      </div>
      {busy && <p className="small muted" style={{ marginTop: 10 }}>İşlem uygulanıyor: {busy}...</p>}
      {err && <p className="small" style={{ color: "var(--danger)", marginTop: 8 }}>{err}</p>}
    </section>
  );
}

function VolumePanel({ client }: { client: CaldirClient }) {
  const [stream, setStream] = useState<VolumeStream>("ring");
  const [level, setLevel] = useState<number>(70);
  const [muted, setMuted] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(v: number) {
    setBusy(true);
    try {
      setMsg(null);
      const st: VolumeState = await client.setVolume(v, stream);
      setLevel(st.level);
      setMuted(st.muted);
    } catch (e) {
      setMsg(humanizePanelError(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => { void submit(level); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  async function caldir() {
    setBusy(true);
    try {
      setMsg(null);
      await client.ring();
      setMsg("Zil komutu gönderildi.");
    } catch (e) {
      setMsg(humanizePanelError(e));
    } finally { setBusy(false); }
  }

  return (
    <section className="panel feature-panel">
      <PanelHeading
        title="Ses ve zil"
        subtitle="Zil, medya, alarm ve arama ses seviyelerini ayrı ayrı ayarlayabilirsin."
      />
      <div className="grid2" style={{ marginBottom: 12 }}>
        {(["ring", "media", "alarm", "call"] as VolumeStream[]).map((s) => (
          <button
            key={s}
            className={"btn" + (stream === s ? " primary" : "")}
            onClick={() => setStream(s)}
          >
            {s === "ring" ? "Zil" : s === "media" ? "Medya" : s === "alarm" ? "Alarm" : "Arama"}
          </button>
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={level}
        onChange={(e) => setLevel(Number(e.target.value))}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, gap: 12 }}>
        <span className="small muted">Seviye: %{level}{muted ? " (sessiz)" : ""}</span>
        <button className="btn" disabled={busy} onClick={() => void submit(level)}>
          Uygula
        </button>
      </div>
      <button className="btn" disabled={busy} onClick={caldir} style={{ marginTop: 10, width: "100%" }}>
        Telefonu çaldır
      </button>
      {msg && <p className="small muted" style={{ marginTop: 10 }}>{msg}</p>}
    </section>
  );
}

function BatteryPanel({ client }: { client: CaldirClient }) {
  const [b, setB] = useState<BatteryInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try { setB(await client.getBattery()); setErr(null); }
    catch (e) { setErr(humanizePanelError(e)); }
  }
  useEffect(() => { void refresh(); }, []);
  const low = b != null && b.level <= 15;
  return (
    <section className="panel feature-panel">
      <PanelHeading
        title="Pil durumu"
        subtitle="Uzaktaki cihazın pil yüzdesini ve şarj durumunu görüntüle."
      />
      <div className={"battery" + (low ? " low" : "") }>
        <div className="meter"><span style={{ width: (b?.level ?? 0) + "%" }} /></div>
        <div style={{ minWidth: 90, textAlign: "right" }}>
          <div style={{ fontWeight: 700 }}>{b == null ? "..." : "%" + String(b.level)}</div>
          <div className="small muted">{b == null ? "" : b.charging ? "şarj oluyor" : "şarj olmuyor"}</div>
        </div>
      </div>
      <button className="btn" onClick={refresh} style={{ marginTop: 10 }}>
        Yenile
      </button>
      {err && <p className="small" style={{ color: "var(--danger)", marginTop: 8 }}>{err}</p>}
    </section>
  );
}

function DevicePanel({ client }: { client: CaldirClient }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function lock() {
    setBusy(true);
    try { await client.lock(); setMsg("Cihaz kilitlendi."); }
    catch (e) { setMsg(humanizePanelError(e)); }
    finally { setBusy(false); setTimeout(() => setMsg(null), 2500); }
  }

  return (
    <section className="panel feature-panel">
      <PanelHeading
        title="Cihaz işlemleri"
        subtitle="Kritik cihaz eylemlerini tek dokunuşla uygulayabilirsin."
      />
      <div className="grid2">
        <button className="btn danger" disabled={busy} onClick={lock}>Ekranı kilitle</button>
      </div>
      {msg && <p className="small muted" style={{ marginTop: 10 }}>{msg}</p>}
    </section>
  );
}

function LocationPanel({ client }: { client: CaldirClient }) {
  const [loc, setLoc] = useState<LocationInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function get() {
    setBusy(true); setErr(null);
    try { setLoc(await client.getLocation()); }
    catch (e) { setErr(humanizePanelError(e)); }
    finally { setBusy(false); }
  }

  return (
    <section className="panel feature-panel">
      <PanelHeading
        title="Konum"
        subtitle="Uygun izinler varsa son bilinen konumu al ve haritada aç."
      />
      {loc ? (
        <a
          href={"https://www.openstreetmap.org/?mlat=" + String(loc.lat) + "&mlon=" + String(loc.lon) + "#map=16/" + String(loc.lat) + "/" + String(loc.lon)}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--accent)", textDecoration: "none" }}
        >
          {loc.lat.toFixed(5)}, {loc.lon.toFixed(5)}
        </a>
      ) : <span className="muted">Henüz alınmadı</span>}
      {loc && loc.accuracyM != null && (
        <div className="small muted" style={{ marginTop: 6 }}>
          Yaklaşık ±{String(loc.accuracyM)} m hassasiyet
        </div>
      )}
      <button className="btn" disabled={busy} onClick={get} style={{ marginTop: 10, width: "100%" }}>
        Konumu getir
      </button>
      {err && <p className="small" style={{ color: "var(--danger)", marginTop: 8 }}>{err}</p>}
    </section>
  );
}

function NotifyPanel({ client }: { client: CaldirClient }) {
  const [title, setTitle] = useState("Çaldır!");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setErr(null);
    try { await client.notify(title, body); setOk(true); setTimeout(() => setOk(false), 1800); }
    catch (e) { setErr(humanizePanelError(e)); }
    finally { setBusy(false); }
  }

  return (
    <section className="panel feature-panel">
      <PanelHeading
        title="Bildirim gönder"
        subtitle="Uzak cihazın ekranına hızlı bir bilgilendirme iletisi gönder."
      />
      <input type="text" placeholder="Başlık" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input type="text" placeholder="Mesaj" value={body} onChange={(e) => setBody(e.target.value)}
        style={{ marginTop: 8 }} />
      <button className="btn primary" disabled={busy || !title} onClick={send} style={{ marginTop: 10, width: "100%" }}>
        {ok ? "Gönderildi" : busy ? "Gönderiliyor..." : "Bildirimi gönder"}
      </button>
      {err && <p className="small" style={{ color: "var(--danger)", marginTop: 8 }}>{err}</p>}
    </section>
  );
}

function FilesPanel({ client }: { client: CaldirClient }) {
  const [path, setPath] = useState("/");
  const [items, setItems] = useState<FileEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load(p: string) {
    setBusy(true); setErr(null);
    try {
      const list = await client.listFiles(p);
      setItems(list);
    } catch (e) {
      setErr(humanizePanelError(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { void load(path); /* eslint-disable-next-line */ }, []);

  return (
    <section className="panel feature-panel">
      <PanelHeading
        title="Dosyalar"
        subtitle="Uygulamanın izin verdiği köklerde dosya ve klasör listesini görüntüle."
      />
      <div className="inline-form">
        <input type="text" value={path} onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(path)} placeholder="/" />
        <button className="btn" disabled={busy} onClick={() => load(path)}>
          {busy ? "Yükleniyor..." : "Listele"}
        </button>
      </div>
      {err && <p className="small" style={{ color: "var(--danger)", marginTop: 8 }}>{err}</p>}
      {items && (
        <ul className="file-list" style={{ marginTop: 12 }}>
          {items.length === 0 && <li className="muted small">Bu dizin boş görünüyor.</li>}
          {items.map((f) => (
            <li key={f.name}>
              <span className="name">
                <span className="ic">{f.isDir ? "D" : "F"}</span>
                {f.name}
              </span>
              <span className="tag">{f.isDir ? "klasör" : String(f.size) + " B"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
