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

export function ControlScreen({ client }: Props) {
  return (
    <>
      <div className="tabs">
        <div style={{ flex: 1, textAlign: "center", color: "var(--fg2)", padding: "9px 0", fontSize: 13, fontWeight: 600 }}>
          Cihaz kontrolü
        </div>
      </div>

      <ConnectivityPanel client={client} />
      <VolumePanel client={client} />
      <BatteryPanel client={client} />
      <DevicePanel client={client} />
      <LocationPanel client={client} />
      <NotifyPanel client={client} />
      <FilesPanel client={client} />
    </>
  );
}

function ConnectivityPanel({ client }: { client: CaldirClient }) {
  const [wifi, setWifi] = useState<boolean | null>(null);
  const [cell, setCell] = useState<boolean | null>(null);
  const [bt, setBt] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(which: "wifi" | "cell" | "bt", val: boolean) {
    try {
      setBusy(which);
      if (which === "wifi") { await client.wifiSet(val); setWifi(val); }
      else if (which === "cell") { await client.cellularSet(val); setCell(val); }
      else { await client.bluetoothSet(val); setBt(val); }
    } catch (e) {
      void e;
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel">
      <h2>Bağlantılar</h2>
      <div className="row">
        <div className="label">
          <span className="k">WiFi</span>
          <span className="v">{wifi == null ? "bilinmiyor" : wifi ? "açık" : "kapalı"}</span>
        </div>
        <div className={"switch" + (wifi === true ? " on" : "")}
          onClick={() => busy == null && toggle("wifi", wifi !== true)} aria-label="WiFi">
        </div>
      </div>
      <div className="row">
        <div className="label">
          <span className="k">Mobil veri</span>
          <span className="v">{cell == null ? "bilinmiyor" : cell ? "açık" : "kapalı"}</span>
        </div>
        <div className={"switch" + (cell === true ? " on" : "")}
          onClick={() => busy == null && toggle("cell", cell !== true)} aria-label="Mobil veri">
        </div>
      </div>
      <div className="row">
        <div className="label">
          <span className="k">Bluetooth</span>
          <span className="v">{bt == null ? "bilinmiyor" : bt ? "açık" : "kapalı"}</span>
        </div>
        <div className={"switch" + (bt === true ? " on" : "")}
          onClick={() => busy == null && toggle("bt", bt !== true)} aria-label="Bluetooth">
        </div>
      </div>
      {busy && <p className="small muted" style={{ marginTop: 10 }}>İşleniyor: {busy}...</p>}
    </section>
  );
}

function VolumePanel({ client }: { client: CaldirClient }) {
  const [stream, setStream] = useState<VolumeStream>("ring");
  const [level, setLevel] = useState<number>(70);
  const [muted, setMuted] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);

  async function submit(v: number) {
    setBusy(true);
    try {
      const st: VolumeState = await client.setVolume(v, stream);
      setLevel(st.level);
      setMuted(st.muted);
    } catch (e) {
      void e;
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
    try { await client.ring(); } catch (e) { void e; } finally { setBusy(false); }
  }

  return (
    <section className="panel">
      <h2>Ses</h2>
      <div className="grid2" style={{ marginBottom: 12 }}>
        {(["ring", "media", "alarm", "call"] as VolumeStream[]).map((s) => (
          <button
            key={s}
            className={"btn" + (stream === s ? " primary" : "")}
            onClick={() => setStream(s)}
          >
            {s === "ring" ? "Zil" : s === "media" ? "Medya" : s === "alarm" ? "Alarm" : "Çağrı"}
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
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        <span className="small muted">Seviye: %{level}{muted ? " (sessiz)" : ""}</span>
        <button className="btn" disabled={busy} onClick={() => void submit(level)}>
          Uygula
        </button>
      </div>
      <button className="btn" disabled={busy} onClick={caldir} style={{ marginTop: 10, width: "100%" }}>
        Cihazı çaldır
      </button>
    </section>
  );
}

function BatteryPanel({ client }: { client: CaldirClient }) {
  const [b, setB] = useState<BatteryInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try { setB(await client.getBattery()); setErr(null); }
    catch (e) { setErr(e instanceof Error ? e.message : "hata"); }
  }
  useEffect(() => { void refresh(); }, []);
  const low = b != null && b.level <= 15;
  return (
    <section className="panel">
      <h2>Pil</h2>
      <div className={"battery" + (low ? " low" : "")}>
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
    catch (e) { setMsg(e instanceof Error ? e.message : "hata"); }
    finally { setBusy(false); setTimeout(() => setMsg(null), 2500); }
  }

  return (
    <section className="panel">
      <h2>Cihaz</h2>
      <div className="grid2">
        <button className="btn danger" disabled={busy} onClick={lock}>Ekran kilitle</button>
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
    catch (e) { setErr(e instanceof Error ? e.message : "hata"); }
    finally { setBusy(false); }
  }

  return (
    <section className="panel">
      <h2>Konum</h2>
      {loc ? (
        <a
          href={"https://www.openstreetmap.org/?mlat=" + String(loc.lat) + "&mlon=" + String(loc.lon) + "#map=16/" + String(loc.lat) + "/" + String(loc.lon)}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--accent)", textDecoration: "none" }}
        >
          {loc.lat.toFixed(5)}, {loc.lon.toFixed(5)}
        </a>
      ) : <span className="muted">Henüz yok</span>}
      {loc && loc.accuracyM != null && (
        <div className="small muted" style={{ marginTop: 6 }}>
          ±{String(loc.accuracyM)}m hassasiyet
        </div>
      )}
      <button className="btn" disabled={busy} onClick={get} style={{ marginTop: 10, width: "100%" }}>
        Konum getir
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

  async function send() {
    setBusy(true);
    try { await client.notify(title, body); setOk(true); setTimeout(() => setOk(false), 1800); }
    catch { /* ignore */ }
    finally { setBusy(false); }
  }

  return (
    <section className="panel">
      <h2>Bildirim</h2>
      <input type="text" placeholder="Başlık" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input type="text" placeholder="Metin" value={body} onChange={(e) => setBody(e.target.value)}
        style={{ marginTop: 8 }} />
      <button className="btn primary" disabled={busy || !title} onClick={send} style={{ marginTop: 10, width: "100%" }}>
        {ok ? "Gönderildi" : busy ? "Gönderiliyor..." : "Bildirim gönder"}
      </button>
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
      setErr(e instanceof Error ? e.message : "hata");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { void load(path); /* eslint-disable-next-line */ }, []);

  return (
    <section className="panel">
      <h2>Dosyalar</h2>
      <input type="text" value={path} onChange={(e) => setPath(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && load(path)} placeholder="/" />
      <button className="btn" disabled={busy} onClick={() => load(path)} style={{ marginTop: 8 }}>
        {busy ? "Listeleniyor..." : "Listele"}
      </button>
      {err && <p className="small" style={{ color: "var(--danger)", marginTop: 8 }}>{err}</p>}
      {items && (
        <ul className="file-list" style={{ marginTop: 12 }}>
          {items.length === 0 && <li className="muted small">Boş</li>}
          {items.map((f) => (
            <li key={f.name}>
              <span className="name">
                <span className="ic">{f.isDir ? "D" : "F"}</span>
                {f.name}
              </span>
              <span className="tag">{f.isDir ? "dir" : String(f.size) + " B"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}