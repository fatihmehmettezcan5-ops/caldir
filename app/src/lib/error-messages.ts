import type { ConnectionState } from "./transport";

export function humanizeTransportError(input: string | null | undefined): string | null {
  if (!input) return null;
  const msg = input.trim();

  if (msg.startsWith("pin_nack:")) {
    if (msg.includes("wrong_pin")) return "PIN yanlış görünüyor. Kontrollü cihazdaki 6 haneli PIN'i tekrar kontrol et.";
    if (msg.includes("expired")) return "PIN süresi dolmuş. Kontrollü cihazda yeni PIN üretip tekrar dene.";
    if (msg.includes("format")) return "PIN biçimi geçersiz. 6 haneli sayısal PIN gir.";
    if (msg.includes("bad_pub")) return "Eşleşme anahtar verisi doğrulanamadı. Tekrar dene.";
    return "PIN doğrulaması başarısız oldu.";
  }

  if (msg === "relay_error" || msg === "relay_connect_failed") {
    return "Relay bağlantısı kurulamadı. Relay adresini ve internet erişimini kontrol et.";
  }
  if (msg === "relay_timeout") {
    return "Relay üzerinde kontrollü cihazdan yanıt alınamadı. PIN'in güncel olduğundan ve kontrollü cihazın hâlâ açık olduğundan emin ol.";
  }
  if (msg === "ws_error") {
    return "WebSocket bağlantısı kurulamadı.";
  }
  if (msg === "bad_pin_format") {
    return "PIN yalnızca 6 haneli rakamlardan oluşmalıdır.";
  }
  if (msg === "no_pairing") {
    return "Hedef cihaz şu anda eşleşme beklemiyor. Kontrollü rolde yeni PIN oluştur.";
  }
  if (msg === "bad_keyx" || msg === "key_switch") {
    return "Anahtar değişimi tamamlanamadı. Güvenli oturum kurulamadı.";
  }
  if (msg === "decrypt_failed" || msg === "decrypt") {
    return "Şifreli trafik doğrulanamadı. Oturumu kapatıp yeniden bağlan.";
  }
  if (msg === "replay") {
    return "Tekrarlanan mesaj algılandı. Güvenlik gereği oturumu yenile.";
  }
  if (msg === "socket_closed") {
    return "Bağlantı beklenmedik şekilde kapandı.";
  }
  if (msg === "socket_error") {
    return "Bağlantı sırasında bir soket hatası oluştu.";
  }
  if (msg === "timeout") {
    return "İstek zaman aşımına uğradı. Cihaz erişilemiyor olabilir.";
  }

  return msg;
}

export function fallbackStateError(state: ConnectionState): string | null {
  switch (state) {
    case "wrong_pin":
      return "PIN yanlış görünüyor. Tekrar deneyin.";
    case "error":
      return "Bağlantı hatası oluştu. Tekrar deneyin.";
    default:
      return null;
  }
}
