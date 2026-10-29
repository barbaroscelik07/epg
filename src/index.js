// EPG sunucusu: kişiye özel süreli adresler, üyelik sitesi, yönetim sayfası, box yükleme
import { KUL, metin, git, durum, kimAnahtari, ucretsizAcik } from "./ortak.js";
import { yonetim } from "./yonetim.js";
import { uyeYolu } from "./uye.js";
import { telegram } from "./telegram.js";
import { anaSayfa, kurulumSayfasi } from "./tanitim.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const yol = url.pathname;

    if (yol.startsWith("/yukle/")) return yukle(request, env, yol);
    if (yol === "/telegram") return telegram(request, env);
    if (yol === "/yonetim" || yol === "/yonetim/") return yonetim(request, env, url);

    const uyeCevap = await uyeYolu(request, env, url);
    if (uyeCevap) return uyeCevap;

    // Kişiye özel adres: /k/<kadi>/<kod>/guide.xml(.gz)  (üyeler)  veya  /k/<kod>/guide.xml(.gz)
    const u = yol.match(/^\/k\/([a-z0-9_.]{3,20})\/([A-Za-z0-9_-]{6,64})\/guide\.xml(\.gz)?$/);
    const m = u ? [null, u[2], u[3] ? "/guide.xml.gz" : "/guide.xml"] : yol.match(/^\/k\/([A-Za-z0-9_-]{6,64})(\/.*)?$/);
    if (m) {
      const k = await env.EPG.get(KUL + m[1], { type: "json" });
      if (!k || (u && k.uye !== u[1])) return metin("Gecersiz adres", 404);  // ad ile kod eşleşmeli
      const d = durum(k, k.ucretsiz ? await ucretsizAcik(env) : false);
      if (d !== "aktif") return metin(d === "durduruldu" ? "Erisim durduruldu" : "Erisim suresi doldu", 403);
      if (env.OLAY) {   // indirme kaydı (beklemeden yazılır, isteği yavaşlatmaz)
        try {
          const kim = kimAnahtari(m[1], k);
          env.OLAY.writeDataPoint({ indexes: [kim], blobs: [kim, request.headers.get("cf-connecting-ip") || "", "indirme"], doubles: [1] });
        } catch { /* kayıt yazılamasa da EPG verilir */ }
      }
      return epg(env, (m[2] || "").endsWith(".xml") ? "xml" : "gz");
    }

    if (yol === "/" && request.method === "GET") return anaSayfa(await ucretsizAcik(env));
    if ((yol === "/kurulum" || yol === "/kurulum/") && request.method === "GET") return kurulumSayfasi();

    // Eski herkese açık adres (yönetim sayfasından kapatılabilir)
    if (!["/guide.xml", "/guide.xml.gz"].includes(yol)) return metin("Bulunamadi", 404);
    if ((await env.EPG.get("acik-erisim")) === "kapali") return metin("Bu adres kapatildi", 403);
    return epg(env, yol.endsWith(".gz") ? "gz" : "xml");
  },
};

// ---------- EPG dosyası ----------
async function epg(env, tur) {
  if (tur === "gz") {
    const gz = await env.EPG.get("guide.xml.gz", { type: "stream" });
    if (!gz) return metin("EPG dosyasi bulunamadi", 404);
    return new Response(gz, {
      headers: { "content-type": "application/gzip", "content-disposition": 'attachment; filename="guide.xml.gz"' },
    });
  }
  const dosya = await env.EPG.get("guide.xml", { type: "stream" });
  if (!dosya) return metin("EPG dosyasi bulunamadi", 404);
  return new Response(dosya, { headers: { "content-type": "application/xml; charset=utf-8" } });
}

// ---------- Android box'tan veri yükleme ----------
async function yukle(request, env, yol) {
  if (request.method !== "PUT") return metin("Yalnizca PUT", 405);
  const anahtar = yol.slice("/yukle/".length);
  if (!/^(digiturk|dsmart|tivibu)-\d{4}-\d{2}-\d{2}$/.test(anahtar)) return metin("Gecersiz anahtar", 400);
  const sifre = await env.EPG.get("yukleme-sifresi");
  if (!sifre || request.headers.get("X-Yukleme-Sifresi") !== sifre) return metin("Yetkisiz", 401);
  const govde = await request.arrayBuffer();
  if (govde.byteLength < 1000 || govde.byteLength > 20 * 1024 * 1024) return metin("Gecersiz boyut", 413);
  await env.EPG.put(anahtar, govde, { expirationTtl: 10 * 24 * 3600 });
  return metin(`Kaydedildi: ${anahtar} (${govde.byteLength} bayt)`);
}
