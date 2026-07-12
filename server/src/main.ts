import { networkInterfaces } from "node:os";
import { PairingManager } from "@caldir/shared";
import { FsPairingStore } from "./pairing-node.js";
import { NodeStubPlatform } from "./platforms/node-stub.js";
import { startSecureServer } from "./server.js";

function pickAddress(): string {
  const nets = networkInterfaces();
  let best: string | null = null;
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        if (/wlan|ap|hotspot|wi-fi|eth/i.test(name) && !best) best = net.address;
        if (!best) best = net.address;
      }
    }
  }
  return best ?? "127.0.0.1";
}

async function main() {
  const host = process.env.CALDIR_HOST ?? "0.0.0.0";
  const port = Number(process.env.CALDIR_PORT ?? 8080);

  const store = new FsPairingStore();
  const pairing = new PairingManager(store);
  const platform = new NodeStubPlatform();
  const server = startSecureServer({ host, port, platform, pairing });

  const addr = pickAddress();
  const pin = pairing.beginPairing();

  console.log("");
  console.log("  +---------------------------+");
  console.log("  |        Çaldır!            |");
  console.log("  +---------------------------+");
  console.log(`  |  PIN:   ${pin}            |`);
  console.log(`  |  Sunucu: ws://${addr}:${server.port} |`);
  console.log("  +---------------------------+");
  console.log("");
  console.log("  Bu PIN'i kontrolcü cihaza gir.");
  console.log("  İnternet YOK. Sadece yerel WiFi / hotspot.");
  console.log("  Çıkış için Ctrl+C.");
  console.log("");
}

main().catch((e) => {
  console.error("Çaldır sunucusu başlatılamadı:", e);
  process.exit(1);
});
