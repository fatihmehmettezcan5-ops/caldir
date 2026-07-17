# Çaldır — Deploy Notları

Bu belge repo içindeki dağıtım / çalıştırma yollarını kısa ve net biçimde ayırır.

## 1. Relay deploy

Bu repo `render.yaml` ile bir relay servisi deploy etmeye hazırdır.

### Render üzerinde genel akış
1. Render hesabında yeni bir **Blueprint** oluştur.
2. Repo olarak `fatihmehmettezcan5-ops/caldir` seç.
3. Render, `render.yaml` içindeki `caldir-relay` servisini oluşturur.
4. Deploy tamamlanınca relay için bir HTTPS/WSS adresi oluşur.
5. Web panel ve APK tarafı bu adresi kullanarak haberleşir.

## 2. Relay çalışma modeli

Relay:
- host ve guest tarafını PIN ile eşler
- frame taşır
- uçtan uca şifreli içerikleri çözmez

Bu yüzden relay deploy'u ürünün ağ erişilebilirliği için önemlidir; ama iş mantığının güveni sadece relay'e emanet değildir.

## 3. Web arayüzü deploy

Web arayüzü `app/` altında Vite ile üretilir.

```bash
cd app
npm run build
```

Çıktı `app/dist/` altında oluşur.

Bu çıktı herhangi bir statik hosting ortamında sunulabilir.

## 4. Android APK

Android APK build'i bu workspace içinde değil, JDK 17 + Android SDK olan bir makinede alınmalıdır.

Genel akış:

```bash
cd app
npm run android
cd android
./gradlew assembleDebug
```

## 5. Yerel geliştirme ile ürün deploy'unu karıştırmama

- `npm run dev:relay` → yerel relay geliştirme
- `npm run dev:app` → yerel web arayüzü geliştirme
- `npm run dev:server` → Node tabanlı yerel host / protokol geliştirme
- Render relay deploy'u → gerçek ürün yolunun parçası

## 6. URL override notu

Kontrol paneli tarafında relay URL'i gerektiğinde query param ile override edilebilir.
Örnek mantık:
- varsayılan relay adresi kullanılır
- istenirse `?relay=wss://ornek-adres` ile başka relay denenebilir

## 7. Tavsiye edilen yayın sırası

1. `npm run typecheck`
2. `npm run build`
3. `npm run smoke`
4. relay deploy
5. web deploy
6. Android APK build ve cihaz testi
7. sınırlı kullanıcı testi
8. genel yayın
