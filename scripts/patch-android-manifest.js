// patch-android-manifest.js
//
// Caldir's headline security property is "no internet, ever". Capacitor's
// default AndroidManifest.xml injects <uses-permission
// android:name="android.permission.INTERNET"/> plus ACCESS_NETWORK_STATE.
// We strip both so even a buggy native plugin can't phone home.
//
// At the same time we ADD the local-only permissions Caldir actually needs:
//   - ACCESS_WIFI_STATE / CHANGE_WIFI_STATE   (WiFi status & toggle)
//   - CHANGE_NETWORK_STATE                     (cellular toggle)
//   - BLUETOOTH_CONNECT / BLUETOOTH_ADMIN      (Android 12+ / classic BT)
//   - ACCESS_FINE_LOCATION                     (location.get)
//   - WAKE_LOCK                                (device.ring)
//   - FOREGROUND_SERVICE                       (WS server keepalive)
//   - POST_NOTIFICATIONS                       (Android 13+; notify.send)
//
//INTERNET removed so the device literally cannot resolve DNS or open any
// socket to a routable address. Local sockets (127.0.0.1, RFC1918) still
// work because Android permits them on the local network without INTERNET.
//
// Idempotent: running twice is a no-op.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const manifestPath = join(
  root,
  "app",
  "android",
  "app",
  "src",
  "main",
  "AndroidManifest.xml",
);

if (!existsSync(manifestPath)) {
  console.error(
    "patch-android-manifest: AndroidManifest.xml bulunamadı.\n" +
    "Önce `npm run cap:add:android -w @caldir/app` çalıştırılmalı.",
  );
  process.exit(2);
}

let src = readFileSync(manifestPath, "utf8");

// ---- 1) Strip cleartext traffic but KEEP INTERNET for the relay. -----------
// The original Çaldır design removed INTERNET entirely because all traffic was
// local. The relay design (v0.3) needs outbound wss:// to the public relay so
// the controlled device can be reached from outside the LAN. Cleartext traffic
// is still disabled (only wss:// is used); the connection is end-to-end
// encrypted so the relay cannot read the payload.

// Only strip ACCESS_NETWORK_STATE (we keep INTERNET for the relay).
const stripPatterns = [
  /<uses-permission\s+android:name="android\.permission\.ACCESS_NETWORK_STATE"\s*\/>\s*\n?/g,
];
let stripped = 0;
for (const re of stripPatterns) {
  const before = src;
  src = src.replace(re, "");
  if (src !== before) stripped++;
}

// Replace cleartext traffic allowance if present.
src = src.replace(/android:usesCleartextTraffic="true"/g, 'android:usesCleartextTraffic="false"');

// ---- 2) Add the local-only permissions Caldir needs (idempotently). ----

const addPerms = [
  "android.permission.ACCESS_WIFI_STATE",
  "android.permission.CHANGE_WIFI_STATE",
  "android.permission.CHANGE_NETWORK_STATE",
  "android.permission.BLUETOOTH_CONNECT",
  "android.permission.BLUETOOTH_ADMIN",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.WAKE_LOCK",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.POST_NOTIFICATIONS",
  // WRITE_EXTERNAL_STORAGE is dead on modern Android; we use scoped storage
  // via MediaStore / SAF where appropriate. Left off intentionally.
];

const permLine = (p) =>
  `    <uses-permission android:name="${p}" />`;

let added = 0;
for (const p of addPerms) {
  const needle = `android:name="${p}"`;
  if (!src.includes(needle)) {
    // Insert just before </manifest> for clarity.
    src = src.replace(
      /<\/manifest>/,
      `${permLine(p)}\n</manifest>`,
    );
    added++;
  }
}

// ---- 3) Collapse any accidental duplicate blank lines near <uses-permission>. --
src = src.replace(/\n\s*\n(\s*<uses-permission)/g, "\n$1");
src = src.replace(/(<\/uses-permission>|<uses-permission[^>]*\/>)\n\s*\n(\s*<uses-permission)/g,
  "$1\n$2");

// Tag this manifest as patched so we can sanity-check via grep.
if (!/<!-- caldir-patched -->/.test(src)) {
  src = src.replace(
    /<\/manifest>/,
    "<!-- caldir-patched -->\n</manifest>",
  );
}

writeFileSync(manifestPath, src, "utf8");

console.log(
  `patch-android-manifest: ${stripped} gereksiz izin kaldırıldı; ` +
  `${added} yerel izin eklendi; INTERNET (relay için) korundu; cleartextTraffic kapandı. ` +
  `(${manifestPath})`,
);
