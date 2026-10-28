// Telegram destek hattı: kişiler bota yazar, mesaj yöneticiye gelir;
// yönetici o mesaja "yanıtla" deyince cevap bot adına kişiye gider (yöneticinin kimliği görünmez).
import { metin } from "./ortak.js";

const ESLEME = "destek:";        // destek:<yöneticideki mesaj no> -> kişinin sohbet no
const ESLEME_SURE = 60 * 86400;  // 60 gün sonra eski mesajlara cevap verilemez

// Webhook gizli anahtarı: bot token'ından türetilir (iş akışı da aynısını hesaplar)
export async function webhookAnahtari(token) {
  const ozet = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(ozet)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function api(env, yontem, govde) {
  const r = await fetch(`${env.TELEGRAM_API || "https://api.telegram.org"}/bot${env.TELEGRAM_TOKEN}/${yontem}`, {   // TELEGRAM_API: yalnızca yerel test
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(govde),
  });
  return r.json().catch(() => ({}));
}

function kisiAdi(m) {
  const f = m.from || {};
  const ad = [f.first_name, f.last_name].filter(Boolean).join(" ") || "İsimsiz";
  return f.username ? `${ad} (@${f.username})` : ad;
}

export async function telegram(request, env) {
  if (request.method !== "POST" || !env.TELEGRAM_TOKEN || !env.TELEGRAM_CHAT_ID) return metin("Yok", 404);
  if (request.headers.get("x-telegram-bot-api-secret-token") !== (await webhookAnahtari(env.TELEGRAM_TOKEN))) {
    return metin("Yetkisiz", 401);
  }
  let guncelleme;
  try { guncelleme = await request.json(); } catch { return metin("ok"); }
  const m = guncelleme.message;
  if (!m || !m.chat || m.chat.type !== "private") return metin("ok");
  const yonetici = String(m.chat.id) === String(env.TELEGRAM_CHAT_ID);

  try {
    if (yonetici) {
      const hedefMesaj = m.reply_to_message && m.reply_to_message.message_id;
      const kisi = hedefMesaj ? await env.EPG.get(ESLEME + hedefMesaj) : null;
      if (!kisi) {
        if (!hedefMesaj && !(m.text || "").startsWith("/")) {
          await api(env, "sendMessage", { chat_id: m.chat.id, text: "Cevap vermek için kişinin mesajına uzun basıp “Yanıtla” deyin." });
        }
        return metin("ok");
      }
      // Cevabı kopyala: kişiye bot adına gider, "iletildi" etiketi ve yöneticinin adı görünmez
      const r = await api(env, "copyMessage", { chat_id: Number(kisi), from_chat_id: m.chat.id, message_id: m.message_id });
      if (!r.ok) await api(env, "sendMessage", { chat_id: m.chat.id, text: "Cevap iletilemedi (kişi botu engellemiş olabilir)." });
      return metin("ok");
    }

    // Kişiden gelen mesaj
    if ((m.text || "").trim() === "/start") {
      await api(env, "sendMessage", {
        chat_id: m.chat.id,
        text: "Merhaba! EPG Deposu destek hattına hoş geldin.\nSorununu ya da soracağını buraya yaz; sitedeki kullanıcı adını da eklersen daha hızlı yardımcı olabiliriz.",
      });
      return metin("ok");
    }
    const bas = await api(env, "sendMessage", { chat_id: env.TELEGRAM_CHAT_ID, text: `Destek mesajı — ${kisiAdi(m)}` });
    const kopya = await api(env, "copyMessage", { chat_id: env.TELEGRAM_CHAT_ID, from_chat_id: m.chat.id, message_id: m.message_id });
    for (const r of [bas, kopya]) {
      if (r.ok && r.result && r.result.message_id) {
        await env.EPG.put(ESLEME + r.result.message_id, String(m.chat.id), { expirationTtl: ESLEME_SURE });
      }
    }
  } catch {
    // Telegram'a her durumda 200 dön, yoksa aynı mesajı tekrar tekrar gönderir
  }
  return metin("ok");
}
