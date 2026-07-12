# AGENTS.md

Bu repoda çalışırken:
- **Build**: npm run build
- **Typecheck**: npm run typecheck
- **Server dev**: npm run dev:server
- **App dev**: npm run dev:app
- **Smoke**: npm run smoke
- **Android sync + patch**: npm run cap:sync -w @caldir/app; npm run cap:patch -w @caldir/app
- **Android APK**: JDK 17 + Android SDK gerekir. `JAVA_HOME` ayarlı iken
  `app/android/gradlew assembleDebug` (bu repo JDK olmadan derlenemiyor).
- Lint komutu şu an TBD; TypeScript `noUnusedLocals` / `noUnusedParameters`
  katıdır.
- Commit yapmadan önce `npm run typecheck` çalıştır.
- Yeni yerleşim (dependency) eklerken workspace paketlerinin package.json'larına ekle.
- BOM: PowerShell `Set-Content -Encoding utf8` BOM ekler (PS5.1); mevcut
  dosyaları düzenlemeden önce `scripts/strip-bom.ps1` yok; elle BOM
  temizliği gerekirse `node -e` ile yapmaktan kaçınma.
- Capacitor plugin'leri MainActivity'i `@CapacitorPlugin` annotation
  değil MainActivity.registerPlugin() ile yükler.
