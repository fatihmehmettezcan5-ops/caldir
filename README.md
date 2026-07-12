# Çaldır!

İnternet bağlantısı OLMADAN, yerel WiFi (Hotspot / WiFi Direct) üzerinden
telefonu uzaktan kontrol etmeye yarayan güvenli uygulama. Aynı APK hem
kullanıcıyı **kontrol eder** hem de **kontrol edilir**.

## Özellikler
- **İnternetsiz çalışma**: Tüm iletişim yerel WiFi üzerinden. AndroidManifest'ten
  INTERNET izni fiziksel olarak kaldırılır; cihazın DNS çözmesi veya dışarıdan
  bir soket açması muhtemel değildir.
- **İki rol bir APK'da**: Uygulama açıldığında rolü seçer:
  - *Kontrolcü*  —  başka bir cihazı kontrol eder (bağlanır + komut gönderir).
  - *Kontrollü*  —  bu cihaz bir WS sunucu açar, PIN gösterir, gelen
    bağlantıları şifreli kanal üzerinden doğrular.
- **Çoklu platform**: Web kontrol paneli (tarayıcı), ve Android APK (Capacitor).
- **Güvenli**: 6 haneli PIN eşleşme + X25519 (ECDH) + AES-256 secretbox
  şifreli kanal. Hiçbir veri dışarı gönderilmez, telemetri yok.
- **Kontroller**: WiFi / Bluetooth aç-kapat, ses/zil seviyesi, pil durumu,
  ekran kilitle, dosya listeleme/aktarımı, konum, sistem bildirimi.

## Mimari (kısa)
- shared/   — Protokol tipleri + şifreleme + saf server core (tweetnacl).
- server/   — Node masaüstü host'u (FS store + ws tabanlı WS sunucu).
- app/      — React + Vite kontrol paneli + Capacitor içine gömülü server
  (Android plugin'leri ile).
- test/     — E2E smoke (server + client handshake iyileştirme).
- scripts/  — AndroidManifest'i internetsiz yapan idempotent patcher.
- app/android/ — Capacitor ürettiği Android projesi + Çaldır Java plugin'leri.

Ayrıntı: ARCHITECTURE.md.

## Hızlı başlangıç

```bash
npm install          # tüm workspace'ler
npm run typecheck    # tip kontrolü
npm run build        # tüm paketleri derle
npm run smoke        # E2E smoke (server + handshake + komut)
```

### 1) Web kontrolcü (en hızlı deneme)

```bash
npm run dev:server   # masaüstü sunucu: PIN + ws:// gösterir
# başka terminal:
npm run dev:app      # http://localhost:5173 -> bağlan + PIN gir
```

### 2) Android APK (iki-rol)

> #### Java gereksinimi
> Bu repoda APK **derlenmiş** değil; çünkü bu geliştirme makinesinde
> JDK yoktu. APK üretmek için senin tarafında:
> - JDK 17 yükle (Android Studio ile birlikte gelir)
> - JAVA_HOME ortam değişkenini ayarla
> - Android SDK 34 (Android Studio yüükler)
>
> Adım-bazlı akış yolu (loop-eng / dokümante):

```bash
# (ilk sefer) Java + Android SDK kurulduktan sonra:
cd app
npm run cap:add:android   # (zaten yapıldı; tekrar gerekmez)
npm run android           # build + sync + manifest patch
```


npm run android otomatik olarak:
  1. Web panelini Vite ile derler
  2. Capacitor'a cap sync android ile kopyalar
  3. scripts/patch-android-manifest.js ile INTERNET iznini kaldırır

#### APK'yı çalıştırma

```bash
# Android cihaz USB ile bağlı veya emülatör gerekebilir:
cd app/android
./gradlew assembleDebug
# çıktı: app/android/app/build/outputs/apk/debug/app-debug.apk
adb install app/build/outputs/apk/debug/app-debug.apk
```

Veya Android Studio ile app/android klasörünü aç ve Run tuşuna bas.

#### Uygulama içi akış

1. APK açılır. **Rol seç**: kontrolcü mi kontrollü mü?
2. Kontrollü seçersen:
   - APK Java plugin'i 0.0.0.0:8080'de bir WS sunucu açar.
   - Ekranda 6 haneli PIN + yerel ws://... URL gösterilir.
3. Kontrolcü olarak başka bir cihazdan o PIN + URL girilir,
   X25519+AES oturum kurulur, kontroller açılır.

## Güvenlik özeti
- PIN asla diske yazılmaz; yalnızca hashPin ile türetilen verifier.
- 3 yanlış deneme = slot tamamen kilitlenir; 5 dakika TTL.
- Oturum anahtarı ECDH shared secret x pairing secret ile HKDF-style türetilir.
- Her mesaj artan counter içerir; replay tamamen reddedilir.
- AndroidManifest'ten INTERNET izni kaldırılır; cleartextTraffic kapalı.
- WAKE_LOCK / BLUETOOTH_CONNECT / ACCESS_FINE_LOCATION / WIFI_STATE gibi
  yalnızca yerel işler için gerekli izinler eklenir; **internet yok**.

## Bilinen sınırlar (v0.2)
- "Mobil veri aç-kapat" bir normal APK ile yasak YAML polidesi
  (WRITE_SECURE_SETTINGS gerekir). Eylem yapılamazsa durum rapor edilir.
- "Ekran kilitle" için DeviceAdmin aktivasyonu gerekir; aktivasyonu
  yapmazsan "device_admin_required" hatası döner.
- Totem/ağ izinsiz/ prefix yöntemi yok; haber anlaşılır.

## Lisans
MIT
