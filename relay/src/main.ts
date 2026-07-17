import { startRelay } from "./index.js";

async function main() {
  const host = process.env.HOST ?? "0.0.0.0";
  const port = Number(process.env.PORT ?? 8080);
  const srv = startRelay({ host, port });
  console.log(`caldir-relay dinliyor :${srv.port}`);
}

main().catch((e) => {
  console.error("caldir-relay baslatilamadi:", e);
  process.exit(1);
});
