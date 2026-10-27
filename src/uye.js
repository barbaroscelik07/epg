// Üyelik sitesi: kayıt, giriş, şifremi unuttum, kullanıcı paneli
import {
  KUL, UYE, OTURUM, html, git, metin, bugun, simdi, kalanGun, durum, DURUM_YAZI, rastgele, bosKodBul,
  kac, adresi, kaydet, uyeAl, uyeKaydet, listele, sifreOzetle, sifreDogru, bildir, ayniSite,
  sablon, mesajKutusu, adresKutusu,
} from "./ortak.js";

const KADI = /^[a-z0-9_.]{3,20}$/;
const OTURUM_GUN = 30;
const BEKLEYEN_SINIR = 20;   // aynı anda en fazla bu kadar onay bekleyen kayıt
const DENEME_SINIR = 5;      // 15 dakikada en fazla bu kadar hatalı giriş

export async function uyeYolu(request, env, url) {
  const yol = url.pathname.replace(/\/$/, "") || "/";
  if (request.method === "POST" && !ayniSite(request, url)) return metin("Gecersiz istek", 403);
  if (yol === "/giris") return giris(request, env, url);
  if (yol === "/kayit") return kayit(request, env, url);
  if (yol === "/sifremi-unuttum") return unuttum(request, env);
  if (yol === "/panel") return panel(request, env, url);
  return null;
}

// ---------- Oturum ----------
function cerez(request, ad) {
  const c = request.headers.get("cookie") || "";
  const m = c.match(new RegExp(`(?:^|;\\s*)${ad}=([^;]+)`));
  return m ? m[1] : "";
}

async function oturumAc(env, kadi) {
  const anahtar = rastgele(32);
  await env.EPG.put(OTURUM + anahtar, kadi, { expirationTtl: OTURUM_GUN * 86400 });
  return `oturum=${anahtar}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${OTURUM_GUN * 86400}`;
}

async function oturumKullanici(request, env) {
  const anahtar = cerez(request, "oturum");
  if (!/^[a-z0-9]{32}$/.test(anahtar)) return null;
  const kadi = await env.EPG.get(OTURUM + anahtar);
  if (!kadi) return null;
  const u = await uyeAl(env, kadi);
  return u ? { u, anahtar } : null;
}

const CEREZ_SIL = "oturum=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

// ---------- Ortak form parçaları ----------
function sayfaYap(baslik, icerik, status = 200, ek = {}) {
  return html(sablon(baslik, `<h1>${kac(baslik)}</h1>${icerik}`), status, ek);
}

function girisFormu(mesaj = "", hata = false, kadi = "") {
  return sayfaYap("EPG Giriş", `${mesajKutusu(mesaj, hata)}
<div class="panel"><form method="post" class="dikey">
<input name="kadi" placeholder="Kullanıcı adı" autocapitalize="none" autocomplete="username" required value="${kac(kadi)}">
<input name="sifre" type="password" placeholder="Şifre" autocomplete="current-password" required>
<button>Giriş</button></form></div>
<p><a href="/kayit">Üye ol</a> · <a href="/sifremi-unuttum">Şifremi unuttum</a></p>`, hata ? 400 : 200);
}

// ---------- Giriş ----------
async function giris(request, env) {
  if (request.method !== "POST") {
    if (await oturumKullanici(request, env)) return git("/panel");
    return girisFormu();
  }
  const f = await request.formData();
  const kadi = String(f.get("kadi") || "").trim().toLowerCase();
  const sifre = String(f.get("sifre") || "");
  if (!KADI.test(kadi)) return girisFormu("Kullanıcı adı ya da şifre yanlış.", true, kadi);
  const denemeAnahtar = "deneme:" + kadi;
  const deneme = Number((await env.EPG.get(denemeAnahtar)) || 0);
  if (deneme >= DENEME_SINIR) return girisFormu("Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.", true, kadi);
  const u = await uyeAl(env, kadi);
  if (!(await sifreDogru(u, sifre))) {
    await env.EPG.put(denemeAnahtar, String(deneme + 1), { expirationTtl: 900 });
    return girisFormu("Kullanıcı adı ya da şifre yanlış.", true, kadi);
  }
  if (deneme) await env.EPG.delete(denemeAnahtar);
  return git("/panel", { "set-cookie": await oturumAc(env, kadi) });
}

// ---------- Kayıt ----------
function kayitFormu(mesaj = "", hata = false, kadi = "") {
  return sayfaYap("EPG Üyelik", `${mesajKutusu(mesaj, hata)}
<div class="panel"><form method="post" class="dikey">
<input name="kadi" placeholder="Kullanıcı adı" autocapitalize="none" autocomplete="username" required maxlength="20" value="${kac(kadi)}">
<input name="sifre" type="password" placeholder="Şifre (en az 8 karakter)" autocomplete="new-password" required minlength="8" maxlength="100">
<input name="sifre2" type="password" placeholder="Şifre (tekrar)" autocomplete="new-password" required>
<button>Üye ol</button></form>
<p class="soluk">Kullanıcı adı 3–20 karakter olmalı: küçük harf (Türkçe karakter olmadan), rakam, nokta ya da alt çizgi.
Üyeliğiniz yönetici onayladıktan sonra açılır.</p></div>
<p><a href="/giris">Zaten üyeyim, giriş yap</a></p>`, hata ? 400 : 200);
}

async function kayit(request, env) {
  if (request.method !== "POST") return kayitFormu();
  const f = await request.formData();
  const kadi = String(f.get("kadi") || "").trim().toLowerCase();
  const sifre = String(f.get("sifre") || "");
  if (!KADI.test(kadi)) return kayitFormu("Kullanıcı adı uygun değil.", true, kadi);
  if (sifre.length < 8 || sifre.length > 100) return kayitFormu("Şifre en az 8 karakter olmalı.", true, kadi);
  if (sifre !== String(f.get("sifre2") || "")) return kayitFormu("Şifreler aynı değil.", true, kadi);
  if (await uyeAl(env, kadi)) return kayitFormu("Bu kullanıcı adı alınmış.", true, kadi);
  const bekleyen = (await listele(env, UYE)).filter((u) => u.durum === "bekliyor").length;
  if (bekleyen >= BEKLEYEN_SINIR) return kayitFormu("Şu an yeni kayıt alınamıyor, daha sonra tekrar deneyin.", true, kadi);
  await uyeKaydet(env, { kadi, ...(await sifreOzetle(sifre)), durum: "bekliyor", kayit: simdi(), kod: null });
  await bildir(env, `Yeni üye kaydı: ${kadi}\nOnaylamak için yönetim sayfasını açın.`);
  return git("/panel", { "set-cookie": await oturumAc(env, kadi) });
}

// ---------- Şifremi unuttum ----------
async function unuttum(request, env) {
  const form = (mesaj = "") => sayfaYap("Şifremi unuttum", `${mesajKutusu(mesaj)}
<div class="panel"><form method="post" class="dikey">
<input name="kadi" placeholder="Kullanıcı adı" autocapitalize="none" required>
<button>Gönder</button></form>
<p class="soluk">Talebiniz yöneticiye iletilir. Yönetici size geçici bir şifre verecek; onunla giriş yapıp şifrenizi değiştirin.</p></div>
<p><a href="/giris">Girişe dön</a></p>`);
  if (request.method !== "POST") return form();
  const f = await request.formData();
  const kadi = String(f.get("kadi") || "").trim().toLowerCase();
  if (KADI.test(kadi)) {
    const u = await uyeAl(env, kadi);
    // Aynı kişi için saatte en fazla bir bildirim
    if (u && (!u.sifirlama || Date.parse(u.sifirlama.replace(" ", "T") + ":00+03:00") < Date.now() - 3600 * 1000)) {
      u.sifirlama = simdi();
      await uyeKaydet(env, u);
      await bildir(env, `Şifre sıfırlama isteği: ${kadi}\nYönetim sayfasından geçici şifre oluşturun.`);
    }
  }
  // Kullanıcı adı var mı yok mu belli etmemek için her durumda aynı cevap
  return form("Talebiniz yöneticiye iletildi.");
}

// ---------- Kullanıcı paneli ----------
async function panel(request, env, url) {
  const o = await oturumKullanici(request, env);
  if (!o) return git("/giris");
  const { u, anahtar } = o;
  let mesaj = "", hata = false;

  if (request.method === "POST") {
    const f = await request.formData();
    const islem = f.get("islem");
    if (islem === "cikis") {
      await env.EPG.delete(OTURUM + anahtar);
      return git("/giris", { "set-cookie": CEREZ_SIL });
    }
    if (islem === "sifre") {
      const yeni = String(f.get("yeni") || "");
      if (!(await sifreDogru(u, String(f.get("mevcut") || "")))) { mesaj = "Mevcut şifre yanlış."; hata = true; }
      else if (yeni.length < 8 || yeni.length > 100) { mesaj = "Yeni şifre en az 8 karakter olmalı."; hata = true; }
      else if (yeni !== String(f.get("yeni2") || "")) { mesaj = "Yeni şifreler aynı değil."; hata = true; }
      else {
        Object.assign(u, await sifreOzetle(yeni));
        u.gecici = false;
        await uyeKaydet(env, u);
        mesaj = "Şifreniz değiştirildi.";
      }
    }
    if (islem === "yenile") {
      const eski = u.kod && (await env.EPG.get(KUL + u.kod, { type: "json" }));
      if (u.durum !== "onayli" || !eski) { mesaj = "Token yenilenemedi."; hata = true; }
      else {
        const yeniKod = await bosKodBul(env);
        eski.sonYenileme = simdi();
        await kaydet(env, yeniKod, eski);
        await env.EPG.delete(KUL + u.kod);
        u.kod = yeniKod;
        await uyeKaydet(env, u);
        mesaj = "Token yenilendi. Eski adres artık çalışmaz; IPTV uygulamanızdaki EPG adresini yenisiyle değiştirin.";
      }
    }
  }

  const k = u.kod ? await env.EPG.get(KUL + u.kod, { type: "json" }) : null;
  let durumBolumu;
  if (u.durum === "bekliyor") {
    durumBolumu = `<div class="kart bekliyor"><div class="ust"><b>${kac(u.kadi)}</b><span class="rozet">Onay bekliyor</span></div>
<div class="soluk">Üyeliğiniz yönetici onayından sonra açılacak. EPG adresiniz burada görünecek.</div></div>`;
  } else if (!k) {
    durumBolumu = `<div class="kart doldu"><div class="ust"><b>${kac(u.kadi)}</b><span class="rozet">Kapalı</span></div>
<div class="soluk">EPG erişiminiz kapatılmış. Yöneticiyle görüşün.</div></div>`;
  } else {
    const d = durum(k);
    durumBolumu = `<div class="kart ${d}"><div class="ust"><b>${kac(u.kadi)}</b><span class="rozet">${DURUM_YAZI[d]}</span></div>
<div>Bitiş: ${kac(k.bitis)}${d === "aktif" ? ` (${kalanGun(k.bitis)} gün kaldı)` : ""}</div>
${d === "doldu" ? '<div class="soluk">Süreniz doldu. Uzatmak için yöneticiyle görüşün.</div>' : ""}
<div style="margin-top:8px">EPG adresiniz (IPTV uygulamanıza EPG kaynağı olarak girin):</div>
${adresKutusu(adresi(url.origin, u.kod))}
<form method="post" onsubmit="return confirm('Yeni adres oluşturulacak ve eski adres çalışmayacak. IPTV uygulamanızdaki EPG adresini yenisiyle değiştirmeniz gerekecek. Devam edilsin mi?')">
<input type="hidden" name="islem" value="yenile"><button class="ikincil">Token yenile</button></form></div>`;
  }

  return sayfaYap("EPG Panel", `${mesajKutusu(mesaj, hata)}
${u.gecici ? mesajKutusu("Geçici şifreyle giriş yaptınız. Lütfen aşağıdan şifrenizi değiştirin.", true) : ""}
${durumBolumu}
<h2>Şifre değiştir</h2>
<div class="panel"><form method="post" class="dikey"><input type="hidden" name="islem" value="sifre">
<input name="mevcut" type="password" placeholder="Mevcut şifre" autocomplete="current-password" required>
<input name="yeni" type="password" placeholder="Yeni şifre (en az 8 karakter)" autocomplete="new-password" required minlength="8" maxlength="100">
<input name="yeni2" type="password" placeholder="Yeni şifre (tekrar)" autocomplete="new-password" required>
<button>Değiştir</button></form></div>
<form method="post"><input type="hidden" name="islem" value="cikis"><button class="ikincil">Çıkış</button></form>`, hata ? 400 : 200);
}
