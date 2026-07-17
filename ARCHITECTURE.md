# Çaldır — Mimari

Bu belge, repo içindeki gerçek mimariyi kısa ve net biçimde özetler.

## 1. Genel mimari resmi

Çaldır iki ana çalışma yoluna sahiptir:

### A) Relay-first ürün akışı
- **Kontrollü cihaz** public relay'e outbound `wss://` bağlantı açar.
- **Kontrolcü** (web arayüzü) aynı relay'e bağlanır.
- Relay iki tarafı 6 haneli PIN ile eşleştirir.
- Çaldır handshake'i ve oturum anahtarı iki uç arasında kurulur.
- Relay yalnızca frame taşır; uygulama içeriğini çözemez.

### B) Node host dev/test akışı
- `server/` paketi yerel güvenli WebSocket host sağlar.
- Bu katman smoke testi ve masaüstü protokol geliştirmesi için kullanılır.
- Ürün mimarisindeki ana yol bu değil, yardımcı mühendislik katmanıdır.

## 2. Katmanlar

### `shared/`
Çekirdek mantık burada yaşar:
- protokol tipleri
- eşleşme mantığı
- kripto yardımcıları
- `PairingManager`
- `Session`

Bu katman mümkün olduğunca platformdan bağımsız tutulur.

### `relay/`
Relay sunucusu:
- host ve guest taraflarını PIN ile eşler
- WebSocket frame'lerini taşır
- şifreli payload içeriğini çözmez

### `server/`
Node tabanlı güvenli host:
- `NodeStubPlatform`
- file-backed pairing store
- `startSecureServer`
- CLI / dev host akışı

Bu katman daha çok protokol doğrulama ve geliştirme içindir.

### `app/`
Kullanıcı arayüzü ve mobil kabuk:
- React + Vite web paneli
- Capacitor tabanlı Android kabuğu
- kontrolcü ekranları
- kontrollü rol için APK tarafı host/relay köprüsü

### `test/`
Smoke / E2E doğrulama:
- handshake
- ping
- komut akışı
- yanlış PIN reddi

## 3. Roller

### Kontrolcü
- web panelden veya uygun kabuktan bağlanır
- ürün modunda relay üstünden PIN ile bağlanır
- dev/test modunda yerel `ws://` Node host'una bağlanabilir
- handshake tamamlanınca komut yollar

### Kontrollü
- özellikle APK tarafında anlamlıdır
- ürün modunda relay'e bağlanır
- PIN gösterir
- gelen komutları platform adapter üzerinden uygular

## 4. Oturum akışı

1. kontrollü taraf `PairingManager.beginPairing()` ile PIN üretir
2. kontrolcü `hello` yollar
3. kontrollü taraf `challenge` döner
4. kontrolcü PIN ile `pin_verify` yollar
5. iki taraf ephemeral public key paylaşır
6. X25519 tabanlı ECDH shared secret hesaplanır
7. pairing secret ile session key türetilir
8. `ready` sonrası tüm komutlar şifreli frame olarak akar

## 5. Güvenlik modeli

- PIN tabanlı kısa ömürlü eşleşme
- hash türevli pairing secret
- X25519 ile anahtar değişimi
- şifreli mesaj kanalı
- artan sequence ile replay reddi
- relay üzerinde içerik görünmezliği

## 6. Android tarafı notu

Repo içindeki Android alanı Capacitor senkronizasyonuyla güncellenen bir
çalışma alanıdır. Yani Android klasörünün bir kısmı jeneratif / türetilmiş
olabilir. Bu yüzden Android build anlatımı her zaman:
- `cap sync`
- gerekirse `cap add android`
- sonra Gradle build

şeklinde düşünülmelidir.

## 7. Bugünkü pratik yorum

Repo'nun bugünkü ana hikâyesi:
- **ürün modu = relay-first**
- **yerel Node host = dev/test**
- **shared = tek doğruluk kaynağı**

Doküman ve kod yorumları bu çerçeveye göre okunmalıdır.
