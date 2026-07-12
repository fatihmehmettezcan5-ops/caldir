import type { CapacitorConfig } from "@capacitor/cli";

// Çaldır Capacitor config.
//
// One important security note: by default @capacitor/android adds the
// INTERNET permission to AndroidManifest.xml. Çaldır MUST NOT have network
// access to the public internet; we strip that permission from the
// generated android project after `npx cap add android`. The companion
// script `capacitor:patch` (npm run) re-applies the patch after every
// `npx cap sync` to keep the manifest clean.
const config: CapacitorConfig = {
  appId: "ai.caldir.app",
  appName: "Çaldır",
  webDir: "dist",
  android: {
    allowMixedContent: false,
    // Don't try to load remote content; everything is local.
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    // Force local-only. No external URL is ever loaded.
    androidScheme: "https",
    cleartext: false,
  },
};

export default config;
