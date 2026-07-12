# Çaldır - Mimari

Bu belge, hem dışa dönük güvenlik modelini hem de katmanları özetler.

## Genel akış (tek oturum)

1. **Sunucu (kontrol EDİLEN cihaz) başlatılır.**
   `PairingManager.beginPairing()`
   ekranda gösterilecek 6 haneli PIN üretir. PIN asla diske yazılmaz;
   yalnızca `hashPin(pin, salt, 1000)` ile türetilen doğrulayıcı ve
   `hashPin(pin, salt, 5000)` ile türetilen oturum tohumu (pairing secret)
   bellekte tutulur. Slot 5 dakika sonra otomatik dolar.

2. **İstemci (kontrol EDEN cihaz) `hello` yollar.** Sunucu, aktif bir pairing
   slotu yoksa hemen reddeder (`no_pairing`). Slot varsa `challenge {nonce,
   salt}` ile yanıt verir.

3. **İstemci PIN girer.** Yerel olarak `pairingSecret = hashPin(pin, salt, 5000)`
   türetilir ve `pin_verify {pin, pub}` yollar. Sunucu sabit-zamanlı
   karşılaştırma yapar (`PairingManager.verifyPin`). 3 yanlış denemede slot
   iptal edilir; her deneme sayılır.

4. **Sunucu `pin_ack {pub}` yollar** ve istemci `keyx {pub}` gönderir. İki
   taraf da `nacl.box.before` (X25519) ile aynı paylaşılan ECDH sırrı elde
   eder. HKDF-style tohum `deterministicSalt(serverPub, clientPub)` ile
   hesaplanır (ekstra round-trip gerektirmeden iki taraf da aynı tuzu bulur).
   Session key = `deriveSessionKey(ecdh_shared, pairingSecret, tuz)`.

5. **Sunucu `ready` yollar.** Bundan sonra tüm mesajlar `enc` çerçevesinde,
   `seal(sessionKey, seq, JSON)` ile şifrelenir. Replay saldırıları her
   mesajdaki artan `s` sayacinin strictly-increasing (>= recvSeq+1) zorunlu
   olmasıyla engellenir.

## Katmanlar

- `shared/` — **Saf** (her platformda birebir). Protokol tipleri + şifreleme
  yardımcıları (tweetnacl) + saf server core: `Platform` arayüzü, `PairingManager`,
  `Session`. pair-store inject edilir; socket/transport inject edilir.
- `server/` — Node masaüstü host'u. `FsPairingStore` + `NodeStubPlatform` +
  `ws` tabanlı `startSecureServer` + `main.ts` CLI.
- `app/` — React + Vite kontrol paneli + Capacitor ile APK'ya gömülü server:
  - `src/lib/transport.ts` + `CaldirClient` -> kontrolcü tarafı
  - `src/server/capacitor-server.ts` -> WS sunucu plugin facade
  - `src/server/capacitor-control.ts` -> Android kontrol plugin facade
  - `src/server/capacitor-host.ts` -> Java plugin + shared `Session` köprülü host
  - `src/server/android-shell-platform.ts` -> `CaldirControl` plugin'leri
    kullanarak gerçek Android sistem çağrıları yapan `Platform` impl.
  - `src/screens/RoleScreen.tsx` -> rol seçim (Kontrol/Kontrollü)
  - `src/screens/ControlledScreen.tsx` -> PIN görüntüleme + host başlat/durdur
- `test/` — E2E smoke (server + from-scratch istemci).
- `scripts/patch-android-manifest.js` — Capacitor Android projesinden
  INTERNET/ACCESS_NETWORK_STATE izinlerini ve `cleartextTraffic`'i kaldırır,
  yalnızca gerekli yerel-soket izinlerini idempotent ekler.
- `app/android/` — Capacitor ürettiği Android projesi + Çaldır Java plugin'leri
  (`CaldirServerPlugin`, `CaldirControlPlugin`). `MainActivity.java` plugin'leri
  `registerPlugin` ile yükler.

## APK içine iki rol

1. APK'a ilk giriste `RoleScreen` ekranı gelir.
2. **Kontrollü** seçilirse:
   - `CapacitorHost.start()` Java tarafında WebSocket sunucusunu başlatır.
   - Java plugin (`CaldirServerPlugin`) 0.0.0.0:8080'i `java.net.InetSocketAddress`
     ile bind eder; INTERNET izni olmadan dinler.
   - Java her bağlantı lifecycle'ı + text frame'i JS'e emit eder.
   - JS tarafında her bağlantı için `shared.Session` oluşur, tum handshake +
     şifreli kanal + komut dispatch JS tarafında. Komutlar Java kontrol
     plugin'leri (`CaldirControlPlugin`) üzerinden gerçek Android API'lerine
     düşer.
3. **Kontrolcü** seçilirse diğer cihazdan PIN girilir ama normal `Transport`/
   `CaldirClient` akışı kullanılır.

## Güvenlik özellikleri

- **İnternetsiz.** Sunucu 0.0.0.0'da dinler; APK AndroidManifest'inden
  INTERNET izniaçıkça kaldırılır. Soket açilir INTERNET gerektirmeden olur
  çünkü RFC1918 adresleri yerel ağ soketleri için yeterlidir.
- **Şifreli kanal.** X25519 + XSalsa20-Poly1305 (secretbox).
- **PIN brute-force koruması.** 3 yanlış deneme = slot sıfırlanır, 5 dk TTL.
- **Replay koruması.** Her mesajda artan sequence sayacı, şifre-çözme öncesinde
  kontrol edilir.
- **Ephemeral anahtarlar.** Her oturumda taze X25519 anahtar pair'i.
- **Rate limit.** Bağlantı başına 5 sn / 20 frame; aşan bağlantı kapatılır.
- **Sabit-zamanlı karşılaştırma.** `nacl.verify` ile PIN ve nonce doğrulaması.
- **AndroidManifest idempotent.** `cap sync` sonrası INTERNET geri gelseydi bile
  `scripts/patch-android-manifest.js` onu tekrar kaldırır.

## Bilinen sınırlar (ilk sürüm)

- **Mobil veri aç-kapat**: normal APK ile yasak YAML poli değişiklik
  WRITE_SECURE_SETTINGS gerekir; sonucu POLI geri döner.
- **Ekran kilitle**: DeviceAdmin aktivasyonlu değilse `device_admin_required`.
- **Büyük dosya**: ilk sürümde total mesaj < 4 MiB (WS payload limit).
- **Java derleme**: bu repo bir geliştirme makinesinde JDK olmadan üretilmedi;
  APK derlemek için JDK 17 ve Android SDK gerekir (README'a bak).
