// EPG sunucusu: kişiye özel süreli adresler + yönetim sayfası + box yükleme
const KUL = "kullanici:"; // KV anahtar öneki: kullanici:<kod>

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const yol = url.pathname;

    if (yol.startsWith("/yukle/")) return yukle(request, env, yol);
    if (yol === "/yonetim" || yol === "/yonetim/") return yonetim(request, env, url);

    // Kişiye özel adres: /k/<kod>/guide.xml.gz veya /k/<kod>/guide.xml
    const m = yol.match(/^\/k\/([A-Za-z0-9_-]{6,64})(\/.*)?$/);
    if (m) {
      const k = await env.EPG.get(KUL + m[1], { type: "json" });
      if (!k) return metin("Gecersiz adres", 404);
      const d = durum(k);
      if (d !== "aktif") return metin(d === "durduruldu" ? "Erisim durduruldu" : "Erisim suresi doldu", 403);
      return epg(env, (m[2] || "").endsWith(".xml") ? "xml" : "gz");
    }

    // Eski herkese açık adres (yönetim sayfasından kapatılabilir)
    if (!["/", "/guide.xml", "/guide.xml.gz"].includes(yol)) return metin("Bulunamadi", 404);
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

// ---------- Yardımcılar ----------
function metin(s, status = 200) {
  return new Response(s, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

// Türkiye saati (UTC+3, yaz saati yok) ile bugünün tarihi: YYYY-MM-DD
function bugun() {
  return new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function ayEkle(tarih, ay) {
  const [y, a, g] = tarih.split("-").map(Number);
  const d = new Date(Date.UTC(y, a - 1 + ay, 1));
  const sonGun = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(g, sonGun));
  return d.toISOString().slice(0, 10);
}

function kalanGun(bitis) {
  return Math.round((Date.parse(bitis) - Date.parse(bugun())) / 86400000);
}

function durum(k) {
  if (!k.aktif) return "durduruldu";
  return k.bitis >= bugun() ? "aktif" : "doldu";
}

// 6 karakterli kod: küçük harf + rakam, karışan karakterler (0 o 1 l i) yok → 31^6 ≈ 887 milyon ihtimal
const HARFLER = "23456789abcdefghjkmnpqrstuvwxyz";
function kodUret() {
  let s = "";
  while (s.length < 6) {
    for (const b of crypto.getRandomValues(new Uint8Array(12))) {
      if (b < 248 && s.length < 6) s += HARFLER[b % 31];   // 248 = 31*8: eşit dağılım
    }
  }
  return s;
}

// Daha önce verilmemiş bir kod üret
async function bosKodBul(env) {
  for (let i = 0; i < 10; i++) {
    const kod = kodUret();
    if (!(await env.EPG.get(KUL + kod))) return kod;
  }
  throw new Error("Bos kod bulunamadi");
}

function kac(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function esit(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let f = 0;
  for (let i = 0; i < a.length; i++) f |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return f === 0;
}

async function kaydet(env, kod, k) {
  await env.EPG.put(KUL + kod, JSON.stringify(k), { metadata: k });
}

// ---------- Yönetim sayfası ----------
async function yonetim(request, env, url) {
  if (!env.YONETIM_SIFRESI) return metin("Yonetim sifresi ayarlanmamis (GitHub secret: YONETIM_SIFRESI)", 503);
  const auth = request.headers.get("authorization") || "";
  let sifre = "";
  if (auth.startsWith("Basic ")) {
    try { sifre = atob(auth.slice(6)).split(":").slice(1).join(":"); } catch { sifre = ""; }
  }
  if (!esit(sifre, env.YONETIM_SIFRESI)) {
    return new Response("Sifre gerekli", {
      status: 401,
      headers: { "www-authenticate": 'Basic realm="EPG yonetim", charset="UTF-8"' },
    });
  }

  if (request.method === "POST") {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) return metin("Gecersiz istek", 403);
    const f = await request.formData();
    const islem = f.get("islem");
    const kod = String(f.get("kod") || "");
    let mesaj = "";
    if (islem === "ekle") {
      const ad = String(f.get("ad") || "").trim().slice(0, 60);
      const ay = f.get("sure") === "12" ? 12 : 6;
      if (!ad) return yonlendir("Ad bos olamaz");
      const yeni = await bosKodBul(env);
      await kaydet(env, yeni, { ad, bitis: ayEkle(bugun(), ay), aktif: true, olusturma: bugun() });
      return yonlendir(`${ad} eklendi`, yeni);
    }
    if (islem === "acik") {
      await env.EPG.put("acik-erisim", f.get("durum") === "kapat" ? "kapali" : "acik");
      return yonlendir("Herkese acik adres ayari kaydedildi");
    }
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(kod)) return yonlendir("Gecersiz kisi");
    const k = await env.EPG.get(KUL + kod, { type: "json" });
    if (!k) return yonlendir("Kisi bulunamadi");
    if (islem === "uzat") {
      const ay = f.get("sure") === "12" ? 12 : 6;
      const temel = k.bitis > bugun() ? k.bitis : bugun();
      k.bitis = ayEkle(temel, ay);
      k.aktif = true;
      await kaydet(env, kod, k);
      mesaj = `${k.ad}: yeni bitis ${k.bitis}`;
    } else if (islem === "durdur") {
      k.aktif = false; await kaydet(env, kod, k); mesaj = `${k.ad} durduruldu`;
    } else if (islem === "ac") {
      k.aktif = true; await kaydet(env, kod, k); mesaj = `${k.ad} yeniden acildi`;
    } else if (islem === "sil") {
      await env.EPG.delete(KUL + kod); mesaj = `${k.ad} silindi`;
    }
    return yonlendir(mesaj);
  }

  // Liste (KV list + metadata: tek okuma)
  const kisiler = [];
  let cursor;
  do {
    const r = await env.EPG.list({ prefix: KUL, cursor });
    for (const a of r.keys) if (a.metadata) kisiler.push({ kod: a.name.slice(KUL.length), ...a.metadata });
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  kisiler.sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  const acik = (await env.EPG.get("acik-erisim")) !== "kapali";
  const mesaj = url.searchParams.get("m") || "";
  const yeniKod = url.searchParams.get("yeni") || "";
  return new Response(sayfa(url.origin, kisiler, acik, mesaj, yeniKod), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function yonlendir(mesaj, yeniKod = "") {
  const q = new URLSearchParams({ m: mesaj });
  if (yeniKod) q.set("yeni", yeniKod);
  return new Response(null, { status: 303, headers: { location: "/yonetim?" + q } });
}

function sayfa(origin, kisiler, acik, mesaj, yeniKod) {
  const adres = (kod) => `${origin}/k/${kod}/guide.xml.gz`;
  const durumYazi = { aktif: "Aktif", durduruldu: "Durduruldu", doldu: "Suresi doldu" };
  const btn = (kod, islem, yazi, ek = "", onay = "") =>
    `<form method="post"${onay ? ` onsubmit="return confirm('${kac(onay)}')"` : ""}><input type="hidden" name="islem" value="${islem}"><input type="hidden" name="kod" value="${kac(kod)}">${ek}<button>${yazi}</button></form>`;
  const satirlar = kisiler.map((k) => {
    const d = durum(k);
    const kalan = kalanGun(k.bitis);
    return `<div class="kart ${d}">
  <div class="ust"><b>${kac(k.ad)}</b><span class="rozet">${durumYazi[d]}</span></div>
  <div>Bitis: ${kac(k.bitis)}${d === "aktif" ? ` (${kalan} gun kaldi)` : ""}</div>
  <div class="adres"><input readonly value="${kac(adres(k.kod))}"><button type="button" onclick="kopyala(this)">Kopyala</button></div>
  <div class="butonlar">
    ${btn(k.kod, "uzat", "+6 ay", '<input type="hidden" name="sure" value="6">')}
    ${btn(k.kod, "uzat", "+1 yil", '<input type="hidden" name="sure" value="12">')}
    ${k.aktif ? btn(k.kod, "durdur", "Durdur") : btn(k.kod, "ac", "Yeniden ac")}
    ${btn(k.kod, "sil", "Sil", "", `${k.ad} silinsin mi? Adresi bir daha calismaz.`)}
  </div>
</div>`;
  }).join("\n");
  const yeniKutu = yeniKod
    ? `<div class="yeni">Yeni adres (TiviMate'e bunu girin):<div class="adres"><input readonly value="${kac(adres(yeniKod))}"><button type="button" onclick="kopyala(this)">Kopyala</button></div></div>`
    : "";
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>EPG Yonetim</title><style>
:root{color-scheme:light dark;--bg:#f4f5f7;--kart:#fff;--yazi:#1d1f23;--soluk:#6b7280;--cizgi:#d9dce1;--vurgu:#2563eb}
@media (prefers-color-scheme:dark){:root{--bg:#111316;--kart:#1b1e22;--yazi:#e8eaed;--soluk:#9aa0a6;--cizgi:#30343a;--vurgu:#60a5fa}}
body{margin:0;padding:16px;background:var(--bg);color:var(--yazi);font:16px/1.45 system-ui,sans-serif;max-width:640px;margin-inline:auto}
h1{font-size:20px;margin:4px 0 12px}h2{font-size:16px;margin:20px 0 8px}
.kart,.panel,.yeni{background:var(--kart);border:1px solid var(--cizgi);border-radius:10px;padding:12px;margin-bottom:10px}
.ust{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.rozet{font-size:13px;padding:2px 8px;border-radius:99px;background:#16a34a22;color:#16a34a}
.durduruldu .rozet{background:#f59e0b22;color:#d97706}.doldu .rozet{background:#dc262622;color:#dc2626}
.adres{display:flex;gap:6px;margin:8px 0}.adres input{flex:1;min-width:0;font-size:13px}
input,select,button{font:inherit;padding:8px;border-radius:8px;border:1px solid var(--cizgi);background:var(--bg);color:var(--yazi)}
button{background:var(--vurgu);color:#fff;border:0;cursor:pointer}
.butonlar{display:flex;flex-wrap:wrap;gap:6px}form{margin:0}
.ekle{display:flex;flex-wrap:wrap;gap:6px}.ekle input[name=ad]{flex:1;min-width:140px}
.mesaj{padding:10px;border-radius:8px;background:#2563eb22;margin-bottom:10px}.soluk{color:var(--soluk);font-size:14px}
</style></head><body>
<h1>EPG Yonetim</h1>
${mesaj ? `<div class="mesaj">${kac(mesaj)}</div>` : ""}
${yeniKutu}
<div class="panel"><b>Yeni kisi</b>
<form method="post" class="ekle"><input type="hidden" name="islem" value="ekle">
<input name="ad" placeholder="Ad (or. Kardesim)" required maxlength="60">
<select name="sure"><option value="6">6 ay</option><option value="12">1 yil</option></select>
<button>Ekle</button></form></div>
<h2>Kisiler (${kisiler.length})</h2>
${satirlar || '<p class="soluk">Henuz kimse yok.</p>'}
<p class="soluk">Yeni eklenen kisi ya da yapilan degisiklik listede ve adreste 1 dakikaya kadar gecikmeyle gorunebilir.</p>
<h2>Herkese acik eski adres</h2>
<div class="panel">${origin}/guide.xml.gz : <b>${acik ? "Acik" : "Kapali"}</b>
<form method="post" style="margin-top:8px"><input type="hidden" name="islem" value="acik"><input type="hidden" name="durum" value="${acik ? "kapat" : "ac"}"><button>${acik ? "Kapat" : "Ac"}</button></form></div>
<script>function kopyala(b){const i=b.previousElementSibling;i.select();(navigator.clipboard?navigator.clipboard.writeText(i.value):Promise.reject()).catch(()=>document.execCommand('copy'));b.textContent='Kopyalandi';setTimeout(()=>b.textContent='Kopyala',1500)}</script>
</body></html>`;
}
