import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Çaldır control panel Vite config.
// We intentionally set a single-page, base-href-friendly build so the same
// bundle can be served standalone or embedded inside the Capacitor WebView.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Help during local dev: allow loading the built bundle from the device.
    host: "0.0.0.0",
  },
  build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 800,
  },
});
