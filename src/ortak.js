// Ortak yardımcılar: tarih, kod, şifre, KV kayıtları, sayfa şablonu, bildirim
export const KUL = "kullanici:"; // kullanici:<kod>  -> EPG erişimi (ad, bitis, aktif, uye?)
export const UYE = "uye:";       // uye:<kadi>       -> üyelik hesabı (şifre, durum, kod)
export const OTURUM = "oturum:"; // oturum:<anahtar> -> kadi (30 gün)

export function metin(s, status = 200) {
  return new Response(s, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

export function html(govde, status = 200, ek = {}) {
  return new Response(govde, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...ek } });
}

export function git(yer, ek = {}) {
  return new Response(null, { status: 303, headers: { location: yer, ...ek } });
}

// Türkiye saati (UTC+3, yaz saati yok)
function trSaat() {
  return new Date(Date.now() + 3 * 3600 * 1000).toISOString();
}
export function bugun() {
  return trSaat().slice(0, 10);
}
export function simdi() {
  return trSaat().slice(0, 16).replace("T", " ");
}

export function ayEkle(tarih, ay) {
  const [y, a, g] = tarih.split("-").map(Number);
  const d = new Date(Date.UTC(y, a - 1 + ay, 1));
  const sonGun = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(g, sonGun));
  return d.toISOString().slice(0, 10);
}

export function kalanGun(bitis) {
  return Math.round((Date.parse(bitis) - Date.parse(bugun())) / 86400000);
}

// ucretsiz: ücretsiz dönem anahtarı açık mı (yalnızca k.ucretsiz olan kayıtlar için önemli)
export function durum(k, ucretsiz = false) {
  if (!k.aktif) return "durduruldu";
  if (k.ucretsiz) return ucretsiz ? "aktif" : "doldu";
  return k.bitis >= bugun() ? "aktif" : "doldu";
}

// ---------- Ücretsiz dönem (yönetim sayfasındaki anahtar) ----------
// Açıkken kayıt olanlar onaysız açılır, bitiş tarihi olmaz; anahtar kapanınca hepsinin erişimi durur.
const UCRETSIZ_ANAHTAR = "ucretsiz-donem";
export const SURESIZ = "9999-12-31";   // ücretsiz üyelerin bitiş yeri (sıralama için)
let ucretsizOnbellek = { deger: false, zaman: 0 };
export async function ucretsizAcik(env) {
  if (Date.now() - ucretsizOnbellek.zaman < 30000) return ucretsizOnbellek.deger;
  const deger = (await env.EPG.get(UCRETSIZ_ANAHTAR)) === "acik";
  ucretsizOnbellek = { deger, zaman: Date.now() };
  return deger;
}
export async function ucretsizAyarla(env, acik) {
  await env.EPG.put(UCRETSIZ_ANAHTAR, acik ? "acik" : "kapali");
  ucretsizOnbellek = { deger: acik, zaman: Date.now() };
}
// Süre eklenirken başlangıç: ücretsiz üye normal üyeye döner ve süresi bugünden başlar
export function uzatmaBaslangici(k) {
  if (k.ucretsiz) { delete k.ucretsiz; return bugun(); }
  return k.bitis > bugun() ? k.bitis : bugun();
}
export const DURUM_YAZI = { aktif: "Aktif", durduruldu: "Durduruldu", doldu: "Süresi doldu" };

// Rastgele metin: küçük harf + rakam, karışan karakterler (0 o 1 l i) yok
const HARFLER = "23456789abcdefghjkmnpqrstuvwxyz";
export function rastgele(uzunluk) {
  let s = "";
  while (s.length < uzunluk) {
    for (const b of crypto.getRandomValues(new Uint8Array(uzunluk * 2))) {
      if (b < 248 && s.length < uzunluk) s += HARFLER[b % 31]; // 248 = 31*8: eşit dağılım
    }
  }
  return s;
}

// Daha önce verilmemiş 6 karakterli EPG kodu (31^6 ≈ 887 milyon ihtimal)
export async function bosKodBul(env) {
  for (let i = 0; i < 10; i++) {
    const kod = rastgele(6);
    if (!(await env.EPG.get(KUL + kod))) return kod;
  }
  throw new Error("Bos kod bulunamadi");
}

export function kac(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function esit(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let f = 0;
  for (let i = 0; i < a.length; i++) f |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return f === 0;
}

// Üyelerde kullanıcı adı da adreste görünür (hatırlatma için; erişimi sağlayan koddur)
export function adresi(origin, kod, kadi = "") {
  return kadi ? `${origin}/k/${kadi}/${kod}/guide.xml.gz` : `${origin}/k/${kod}/guide.xml.gz`;
}

// ---------- KV kayıtları ----------
export async function kaydet(env, kod, k) {
  await env.EPG.put(KUL + kod, JSON.stringify(k), { metadata: k });
}

export async function uyeAl(env, kadi) {
  return env.EPG.get(UYE + kadi, { type: "json" });
}

export async function uyeKaydet(env, u) {
  const { kadi, durum, kayit, kod, sifirlama, odeme } = u; // listede gerekenler (şifre özeti metadata'ya konmaz)
  await env.EPG.put(UYE + u.kadi, JSON.stringify(u), {
    metadata: { kadi, durum, kayit, kod: kod || null, sifirlama: sifirlama || null, odeme: odeme || null },
  });
}

// İndirme kaydı ve istatistik anahtarı: üyelerde kullanıcı adı (token yenilense de aynı kalır), diğerlerinde kod
export function kimAnahtari(kod, k) {
  return k.uye ? "u:" + k.uye : "k:" + kod;
}

// Letgo ürün tutarına göre hediye EPG süresi
export const PLANLAR = [{ tutar: 150, ay: 3 }, { tutar: 200, ay: 6 }, { tutar: 250, ay: 12 }];
export function sureYaz(ay) {
  return ay === 12 ? "1 yıl" : `${ay} ay`;
}
export function aySec(deger) {
  return { 3: 3, 6: 6, 12: 12 }[String(deger)] || 6;
}
export function odemeAciklamasi(kadi) {
  return `Letgo ödemesi: ${kadi}`;
}

export async function listele(env, onek) {
  const sonuc = [];
  let cursor;
  do {
    const r = await env.EPG.list({ prefix: onek, cursor });
    for (const a of r.keys) if (a.metadata) sonuc.push({ anahtar: a.name.slice(onek.length), ...a.metadata });
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  return sonuc;
}

// ---------- Şifre (PBKDF2-SHA256, 100.000 tekrar) ----------
const TEKRAR = 100000;
function b64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
async function ozet(sifre, tuzB64, n) {
  const anahtar = await crypto.subtle.importKey("raw", new TextEncoder().encode(sifre), "PBKDF2", false, ["deriveBits"]);
  const tuz = Uint8Array.from(atob(tuzB64), (c) => c.charCodeAt(0));
  return b64(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: tuz, iterations: n }, anahtar, 256));
}
export async function sifreOzetle(sifre) {
  const tuz = b64(crypto.getRandomValues(new Uint8Array(16)));
  return { tuz, n: TEKRAR, hash: await ozet(sifre, tuz, TEKRAR) };
}
export async function sifreDogru(u, sifre) {
  if (!u || !u.tuz || !u.hash) return false;
  return esit(await ozet(sifre, u.tuz, u.n || TEKRAR), u.hash);
}

// ---------- Telegram bildirimi (TELEGRAM_TOKEN + TELEGRAM_CHAT_ID varsa) ----------
export async function bildir(env, yazi) {
  if (!env.TELEGRAM_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: yazi }),
    });
  } catch {
    // bildirim gitmese de işlem devam eder
  }
}

// Başka siteden gönderilen formları reddet
export function ayniSite(request, url) {
  const o = request.headers.get("origin");
  return !o || o === url.origin;
}

// ---------- Sayfa şablonu ----------
const STIL = `
:root{color-scheme:light dark;--bg:#f4f5f7;--kart:#fff;--yazi:#1d1f23;--soluk:#6b7280;--cizgi:#d9dce1;--vurgu:#2563eb;--hata:#dc2626}
@media (prefers-color-scheme:dark){:root{--bg:#111316;--kart:#1b1e22;--yazi:#e8eaed;--soluk:#9aa0a6;--cizgi:#30343a;--vurgu:#60a5fa;--hata:#f87171}}
*{box-sizing:border-box}
body{margin:0;padding:16px;background:var(--bg);color:var(--yazi);font:16px/1.45 system-ui,sans-serif;max-width:640px;margin-inline:auto}
h1{font-size:20px;margin:4px 0 12px}h2{font-size:16px;margin:20px 0 8px}
a{color:var(--vurgu)}
.kart,.panel,.yeni{background:var(--kart);border:1px solid var(--cizgi);border-radius:10px;padding:12px;margin-bottom:10px}
.ust{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:8px}
.rozet{font-size:13px;padding:2px 8px;border-radius:99px;background:#16a34a22;color:#16a34a;white-space:nowrap}
.durduruldu .rozet,.bekliyor .rozet{background:#f59e0b22;color:#d97706}.doldu .rozet{background:#dc262622;color:#dc2626}
.adres{display:flex;gap:6px;margin:8px 0}.adres input{flex:1;min-width:0;font-size:13px}
input,select,button{font:inherit;padding:8px;border-radius:8px;border:1px solid var(--cizgi);background:var(--bg);color:var(--yazi)}
button{background:var(--vurgu);color:#fff;border:0;cursor:pointer}
button.ikincil{background:transparent;color:var(--vurgu);border:1px solid var(--cizgi)}
.butonlar{display:flex;flex-wrap:wrap;gap:6px}form{margin:0}
.ekle{display:flex;flex-wrap:wrap;gap:6px}.ekle input[name=ad]{flex:1;min-width:140px}
.dikey{display:flex;flex-direction:column;gap:8px}.dikey input{width:100%}
.mesaj{padding:10px;border-radius:8px;background:#2563eb22;margin-bottom:10px}
.mesaj.hata{background:#dc262622;color:var(--hata)}
.soluk{color:var(--soluk);font-size:14px}
`;
const KOPYALA = `<script>function kopyala(b){const i=b.previousElementSibling;i.select();(navigator.clipboard?navigator.clipboard.writeText(i.value):Promise.reject()).catch(()=>document.execCommand('copy'));b.textContent='Kopyalandı';setTimeout(()=>b.textContent='Kopyala',1500)}</script>`;

export function sablon(baslik, icerik) {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${kac(baslik)}</title><style>${STIL}</style></head><body>
${icerik}
${KOPYALA}
</body></html>`;
}

export function mesajKutusu(mesaj, hata = false) {
  return mesaj ? `<div class="mesaj${hata ? " hata" : ""}">${kac(mesaj)}</div>` : "";
}

export function adresKutusu(adres) {
  return `<div class="adres"><input readonly value="${kac(adres)}"><button type="button" onclick="kopyala(this)">Kopyala</button></div>`;
}
