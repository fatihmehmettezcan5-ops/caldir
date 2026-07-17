# Çaldır!

Çaldır!, bir Android cihazı başka bir cihazdan güvenli biçimde kontrol etmeye
odaklanan bir projedir. Aynı APK hem **kontrol edilen cihaz** hem de
**kontrolcü tarafına yardımcı kabuk** olarak çalışabilir; web arayüzü ise esas
kontrol panelidir.

## Mevcut durum: v0.3 relay-first mimari

Bu repo artık **relay-first** çalışır.

### Ürün modu
- Kontrollü cihaz (özellikle Android APK) public relay'e outbound `wss://`
  bağlantı açar.
- Kontrolcü (web arayüzü) aynı relay'e bağlanır.
- İki taraf 6 haneli **PIN** ile eşleşir.
- Relay yalnızca çerçeveleri taşır; içerik **uçtan uca şifrelidir**
  (X25519 + secretbox tabanlı oturum).
- Aynı Wi‑Fi ağında olma zorunluluğı yoktur.

### Geliştirme / test modu
Repo içinde ayrıca Node tabanlı bir **yerel güvenli WebSocket host** da bulunur:
- `server/` paketi
- yerel geliştirme
- smoke testi
- protokol doğrulama
- stub platform ile masaüstü denemeleri

> Kısa özet: **gerçek kullanım akışı relay-first**, **Node server ise dev/test
> yardımcısıdır**.

## Özellikler
- 6 haneli PIN ile eşleşme
- uçtan uca şifreli kontrol kanalı
- kontrolcü web arayüzü
- kontrollü rol için Android APK akışı
- bağlantı kontrolleri (WiFi / Bluetooth / mobil veri komutları platforma göre)
- ses / zil / pil / konum / dosya / bildirim / ekran kilidi gibi komutlar
- relay ile NAT/CGNAT arkasında çalışma
- smoke test ile temel protokol doğrulaması

## Repo yapısı
- `shared/` — protokol tipleri, kripto yardımcıları, eşleşme ve oturum mantığı
- `server/` — Node tabanlı güvenli WebSocket host (dev/test)
- `relay/` — PIN tabanlı relay sunucusu
- `app/` — React + Vite kontrol paneli ve Capacitor kabuğu
- `test/` — E2E smoke testi
- `scripts/` — yardımcı scriptler
- `ARCHITECTURE.md` — ayrıntılı mimari özeti
- `DEPLOYMENT.md` — deploy ve yayın yolları
- `AGENTS.md` — bu repo üzerinde çalışırken izlenecek operasyon notları

## Önemli ürün notu
Tarayıcıdaki uygulama esas olarak **kontrolcü** rolünü hedefler.
**Kontrollü** rol, repo içindeki mevcut UI akışında özellikle APK/Capacitor tarafı
ile anlamlıdır. Bu yüzden browser demosu ile APK akışını aynı şey gibi
anlatmamak gerekir.

## Hızlı başlangıç

```bash
npm install
npm run typecheck
npm run build
npm run smoke
```

## Hangi akış ne için?

| Senaryo | Kullanılacak yol |
|---|---|
| Gerçek ürün demosu / APK'dan uzaktan kontrol | **relay-first** akış |
| Protokol geliştirme / masaüstünde hızlı deneme | `npm run dev:server` |
| Web arayüzü geliştirme | `npm run dev:app` |
| Relay davranışı geliştirme | `npm run dev:relay` |
| Temel uçtan uca doğrulama | `npm run smoke` |

## Geliştirme komutları

```bash
npm run dev:app
npm run dev:relay
npm run dev:server
```

### Ne işe yararlar?
- `npm run dev:app` → React/Vite kontrol paneli
- `npm run dev:relay` → relay sunucusunu yerelde ayağa kaldırır
- `npm run dev:server` → Node tabanlı yerel güvenli WS host'u çalıştırır
  (ürün modundan çok protokol/dev testi için)

## En doğru demo akışları

### 1) Relay tabanlı akış (önerilen ana akış)
1. `npm run dev:relay`
2. başka terminalde `npm run dev:app`
3. kontrollü tarafı APK üzerinde aç
4. APK'nın gösterdiği 6 haneli PIN'i web panelde gir
5. relay üstünden uçtan uca şifreli oturum kur

### 2) Node host / protokol geliştirme akışı
1. `npm run dev:server`
2. terminalde üretilen PIN ve `ws://` adresini kullan
3. gerektiğinde protokolü / smoke testlerini / host davranışını geliştir
4. bu akış ürün demosundan çok teknik doğrulama içindir

## Android APK

### Gereksinimler
- JDK 17
- Android SDK
- `JAVA_HOME` ayarlı ortam

### App build / sync

```bash
cd app
npm run android
```

Bu komut:
1. web arayüzünü derler
2. Capacitor sync çalıştırır
3. Android patch scriptini uygular

### Android projesi notu
`app/android` klasörü Capacitor tarafından yeniden üretilebilir / senkronize
edilebilir çalışma alanıdır. Repo içinde Android tarafı eksik veya yeniden
oluşturulması gereken bir durumda ise:

```bash
cd app
npm run cap:add:android
npm run cap:sync
npm run cap:patch
```

### Debug APK

```bash
cd app/android
./gradlew assembleDebug
```

## Güvenlik özeti
- PIN asla açık biçimde kalıcı store'a yazılmaz
- eşleşme için hash tabanlı doğrulama kullanılır
- oturum anahtarı ECDH + türetilmiş pairing secret ile kuruludur
- tüm uygulama mesajları artan sayaçlarla replay korumalıdır
- relay içerik taşıyıcısıdır; uygulama içeriğini okuyamaz

## Deploy

Deploy yollarının özeti için `DEPLOYMENT.md` dosyasına bak.

Kısa hali:
- `render.yaml` → relay deploy
- `app/dist/` → web arayüzü statik çıktı
- `app/android` → Android build alanı

## Bilinen sınırlar
- bazı Android sistem komutları cihaz / üretici / izin kısıtlarına bağlıdır
- ekran kilidi gibi bazı özellikler ek Android yetkilendirmeleri ister
- relay-first akışta internet erişimi gerekir; yerel Node host akışı ise ayrı
  bir dev/test yoludur
- APK derleme bu workspace içinde değil, JDK + Android SDK olan ortamda yapılır

## Lisans
MIT
