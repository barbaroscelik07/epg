// Üyelik sitesi: kayıt, giriş, şifremi unuttum, kullanıcı paneli
import {
  KUL, UYE, OTURUM, html, git, metin, bugun, simdi, kalanGun, durum, DURUM_YAZI, rastgele, bosKodBul,
  kac, adresi, kaydet, uyeAl, uyeKaydet, listele, sifreOzetle, sifreDogru, bildir, ayniSite,
  PLANLAR, sureYaz, odemeAciklamasi,
} from "./ortak.js";
import { uyeSablon, marka, uyari, halka, tarihYaz, IKON } from "./gorunum.js";

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
  if (yol === "/panel/durum") return panelDurum(request, env);
  return null;
}

// ---------- Oturum ----------
function cerez(request, ad) {
  const c = request.headers.get("cookie") || "";
  const m = c.match(new RegExp(`(?:^|;\\s*)${ad}=([^;]+)`));
  return m ? m[1] : "";
}

// gecici=true: bu oturum geçici şifreyle açıldı (şifre değiştirirken mevcut şifre sorulmaz)
async function oturumAc(env, kadi, gecici = false) {
  const anahtar = rastgele(32);
  await env.EPG.put(OTURUM + anahtar, gecici ? kadi + "#gecici" : kadi, { expirationTtl: OTURUM_GUN * 86400 });
  return `oturum=${anahtar}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${OTURUM_GUN * 86400}`;
}

async function oturumKullanici(request, env) {
  const anahtar = cerez(request, "oturum");
  if (!/^[a-z0-9]{32}$/.test(anahtar)) return null;
  const deger = await env.EPG.get(OTURUM + anahtar);
  if (!deger) return null;
  const [kadi, isaret] = deger.split("#");
  const u = await uyeAl(env, kadi);
  return u ? { u, anahtar, geciciOturum: isaret === "gecici" && !!u.gecici } : null;
}

// İşlem sonrası yönlendirmede gösterilen mesajlar (/panel?m=...)
const PANEL_MESAJ = {
  sifre: "Şifren değiştirildi.",
  odeme: "Ödeme bildirimin alındı. Yönetici kontrol edip onaylayınca süren başlayacak.",
  "odeme-var": "Ödeme bildirimin zaten alındı, yönetici onayını bekle.",
  token: "Token yenilendi. Eski adres artık çalışmaz; IPTV uygulamandaki EPG adresini yenisiyle değiştir.",
};

// Onay bekleyen sayfa bunu yoklar; durum değişince sayfa kendini yeniler
async function panelDurum(request, env) {
  const o = await oturumKullanici(request, env);
  return new Response(JSON.stringify({ durum: o ? o.u.durum : null }), {
    status: o ? 200 : 401,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

const CEREZ_SIL = "oturum=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

// ---------- Giriş / kayıt / şifremi unuttum sayfa iskeleti ----------
function girisIskelet(baslik, ust, h1, aciklama, mesaj, tur, icerik, status = 200) {
  return html(uyeSablon(baslik, `<div class="kap">
<div class="ust-satir">${marka()}${ust}</div>
<div class="baslik"><h1>${h1}</h1><p>${aciklama}</p></div>
${uyari(mesaj, tur)}
${icerik}
<div class="dip">EPG Deposu · Yayın akışı hizmeti</div>
</div>`), status);
}

const KADI_ALANI = (kadi, otomatik) => `<div class="alan"><label for="kadi">Kullanıcı adı</label>
<input id="kadi" name="kadi" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="${otomatik}" required maxlength="20" value="${kac(kadi)}"></div>`;

function girisFormu(mesaj = "", hata = false, kadi = "") {
  return girisIskelet("Giriş", "", "Tekrar hoş geldin", "Yayın akışı adresine ve üyelik bilgilerine ulaşmak için giriş yap.",
    mesaj, hata ? "hata" : "bilgi", `<form method="post" class="alanlar">
${KADI_ALANI(kadi, "username")}
<div class="alan"><div class="alan-ust"><label for="sifre">Şifre</label><a href="/sifremi-unuttum" style="font-size:14px">Şifremi unuttum</a></div>
<input id="sifre" name="sifre" type="password" autocomplete="current-password" required></div>
<button class="dugme" style="margin-top:8px">Giriş yap</button>
</form>
<div class="alt-kart"><span>Hesabın yok mu?</span><a href="/kayit">Üye ol</a></div>`, hata ? 400 : 200);
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
  return git("/panel", { "set-cookie": await oturumAc(env, kadi, !!u.gecici) });
}

// ---------- Kayıt ----------
function kayitFormu(mesaj = "", hata = false, kadi = "") {
  return girisIskelet("Üye ol", '<a href="/giris" style="font-size:14px">Giriş yap</a>', "Üye ol",
    "Hesabın yönetici onayından sonra açılır. Onaylanınca yayın akışı adresin panelinde görünür.",
    mesaj, hata ? "hata" : "bilgi", `<form method="post" class="alanlar">
<div class="alan"><label for="kadi">Kullanıcı adı</label>
<input id="kadi" name="kadi" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username" required maxlength="20" value="${kac(kadi)}">
<span class="ipucu">3–20 karakter: küçük harf (Türkçe karakter olmadan), rakam, nokta ya da alt çizgi</span></div>
<div class="alan"><label for="sifre">Şifre</label>
<input id="sifre" name="sifre" type="password" autocomplete="new-password" required minlength="8" maxlength="100" oninput="guc(this)">
<div class="guc" aria-hidden="true"><i></i><i></i><i></i></div><span class="ipucu">En az 8 karakter</span></div>
<div class="alan"><label for="sifre2">Şifre (tekrar)</label>
<input id="sifre2" name="sifre2" type="password" autocomplete="new-password" required></div>
<button class="dugme" style="margin-top:8px">Üye ol</button>
</form>`, hata ? 400 : 200);
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
  const form = (mesaj = "") => girisIskelet("Şifremi unuttum", '<a href="/giris" style="font-size:14px">Giriş yap</a>', "Şifremi unuttum",
    "Talebin yöneticiye iletilir. Yönetici sana geçici bir şifre verecek; onunla giriş yapıp şifreni değiştir.",
    mesaj, "iyi", `<form method="post" class="alanlar">
${KADI_ALANI("", "username")}
<button class="dugme" style="margin-top:8px">Talep gönder</button>
</form>`);
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
  return form("Talebin yöneticiye iletildi.");
}

// ---------- Kullanıcı paneli ----------
async function panel(request, env, url) {
  const o = await oturumKullanici(request, env);
  if (!o) return git("/giris");
  const { u, anahtar, geciciOturum } = o;
  let mesaj = PANEL_MESAJ[url.searchParams.get("m")] || "", hata = false, sifreIslemi = false;

  if (request.method === "POST") {
    const f = await request.formData();
    const islem = f.get("islem");
    if (islem === "cikis") {
      await env.EPG.delete(OTURUM + anahtar);
      return git("/giris", { "set-cookie": CEREZ_SIL });
    }
    if (islem === "sifre") {
      sifreIslemi = true;
      const yeni = String(f.get("yeni") || "");
      if (!geciciOturum && !(await sifreDogru(u, String(f.get("mevcut") || "")))) { mesaj = "Mevcut şifre yanlış."; hata = true; }
      else if (yeni.length < 8 || yeni.length > 100) { mesaj = "Yeni şifre en az 8 karakter olmalı."; hata = true; }
      else if (yeni !== String(f.get("yeni2") || "")) { mesaj = "Yeni şifreler aynı değil."; hata = true; }
      else {
        Object.assign(u, await sifreOzetle(yeni));
        u.gecici = false;
        await uyeKaydet(env, u);
        return git("/panel?m=sifre");
      }
    }
    if (islem === "odeme") {
      const plan = PLANLAR.find((p) => String(p.tutar) === String(f.get("tutar")));
      if (!plan || !["bekliyor", "onayli"].includes(u.durum)) { mesaj = "Bir tutar seç."; hata = true; }
      else if (u.odeme) return git("/panel?m=odeme-var");
      else {
        u.odeme = { tutar: plan.tutar, ay: plan.ay, tarih: simdi() };
        await uyeKaydet(env, u);
        await bildir(env, `Ödeme bildirimi: ${u.kadi}\n${plan.tutar} TL · ${sureYaz(plan.ay)}\nBanka açıklaması: ${odemeAciklamasi(u.kadi)}\nKontrol edip yönetim sayfasından onaylayın.`);
        return git("/panel?m=odeme");
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
        return git("/panel?m=token");
      }
    }
  }

  const k = u.kod ? await env.EPG.get(KUL + u.kod, { type: "json" }) : null;
  const ustBar = `<header class="ust-bar"><div>${marka(20)}<div class="sag">
<details class="menu"><summary aria-label="Kullanıcı menüsü"><span class="avatar">${kac(u.kadi[0])}</span></summary>
<div class="menu-kutu">
<div class="menu-ad">${kac(u.kadi)}</div>
<a href="#sifre" onclick="sifreAc()">${IKON.kilit}Şifre değiştir</a>
<form method="post"><input type="hidden" name="islem" value="cikis"><button>${IKON.cikis}Çıkış</button></form>
</div></details>
</div></div></header>`;
  const kutuBas = (ikon, zemin, renk, baslik) =>
    `<div class="kutu-bas"><span class="kutu-ikon" style="background:var(${zemin});color:var(${renk})">${ikon}</span><h2>${baslik}</h2></div>`;

  let bolumler = "";
  if (u.durum === "bekliyor") {
    bolumler = `<section class="kutu bekle-orta">
<span class="bekle-ikon">${IKON.saat}</span>
<span class="rozet bekliyor" style="align-self:center">Onay bekliyor</span>
<h2>Üyeliğin incelemede</h2>
<p style="font-size:15px">Yönetici onayladığında EPG adresin ve bitiş tarihin burada görünecek. Sayfa açık kaldığı sürece kendiliğinden yenilenir.</p>
</section>
<script>(function(){let s=0;async function b(){if(document.visibilityState!=="visible"||s)return;s=1;try{const r=await fetch("/panel/durum",{cache:"no-store"});const j=r.ok?await r.json():null;if(!j||j.durum!=="bekliyor"){location.replace("/panel");return}}catch(e){}s=0}setInterval(b,30000);document.addEventListener("visibilitychange",b)})()</script>
<!--odeme-->
<section class="kutu"><h2 style="font-size:16px">Sırada ne var?</h2>
<div class="adim"><span class="adim-no bitti">${IKON.tamam}</span><div><b>Kayıt alındı</b><br><span>${tarihYaz(u.kayit)}</span></div></div>
<div class="adim"><span class="adim-no ${u.odeme ? "bitti" : "simdi"}">${u.odeme ? IKON.tamam : "2"}</span><div><b>Ödemeyi gönder ve bildir</b><br><span>${u.odeme ? `${u.odeme.tutar} TL · ${sureYaz(u.odeme.ay)} bildirildi` : "Yukarıdaki bilgilerle gönder, sonra “Ödemeyi yaptım”a bas"}</span></div></div>
<div class="adim"><span class="adim-no${u.odeme ? " simdi" : ""}">3</span><div><b>Yönetici onayı</b><br><span>Ödeme kontrol edilince süren başlar</span></div></div>
<div class="adim"><span class="adim-no">4</span><div><b>EPG adresini al</b><br><span>IPTV uygulamana EPG kaynağı olarak gir</span></div></div>
</section>`;
  } else if (!k) {
    bolumler = `<section class="kutu"><span class="rozet kapali">Kapalı</span><h2 style="font-size:18px">EPG erişimin kapatılmış</h2><p>Bilgi için yöneticiyle görüş.</p></section>`;
  } else {
    const d = durum(k);
    const kalan = Math.max(0, kalanGun(k.bitis));
    const toplam = Math.max(1, Math.round((Date.parse(k.bitis) - Date.parse(k.olusturma || bugun())) / 86400000));
    const adres = adresi(url.origin, u.kod, u.kadi);
    bolumler = `<section class="kutu durum-kutu">
${halka(d === "aktif" ? kalan : 0, d === "aktif" ? kalan / toplam : 0)}
<div class="durum-bilgi">
<span class="rozet ${d}">${d === "aktif" ? "● " : ""}${DURUM_YAZI[d]}</span>
<span class="etiket">Bitiş tarihi</span><span class="deger">${tarihYaz(k.bitis)}</span>
<span class="etiket" style="margin-top:4px">${d === "aktif" ? "Süre uzatma için yöneticiyle görüş." : d === "doldu" ? "Süren doldu. Uzatmak için yöneticiyle görüş." : "Erişimin durduruldu. Yöneticiyle görüş."}</span>
</div></section>
<section class="kutu">
${kutuBas(IKON.link, "--vurgu-acik", "--vurgu-yazi", "EPG adresin")}
<p>IPTV uygulamana EPG kaynağı olarak bu adresi gir. <a href="/kurulum">Nasıl kurulur?</a></p>
<div class="adres">${kac(adres)}</div>
<button type="button" class="dugme" data-adres="${kac(adres)}" onclick="kopyala(this)">${IKON.kopya}<span>Adresi kopyala</span></button>
</section>
<!--odeme-->
<section class="kutu">
${kutuBas(IKON.yenile, "--turuncu-acik", "--turuncu", "Token yenile")}
<p>Adresin başkasının eline geçtiyse yenile. Eski adres hemen kapanır; uygulamandaki EPG adresini yenisiyle değiştirmen gerekir.</p>
${k.sonYenileme ? `<span class="ipucu">Son yenileme: ${tarihYaz(k.sonYenileme)}</span>` : ""}
<form method="post" onsubmit="return confirm('Yeni adres oluşturulacak ve eski adres hemen kapanacak. IPTV uygulamandaki EPG adresini yenisiyle değiştirmen gerekecek. Devam edilsin mi?')">
<input type="hidden" name="islem" value="yenile"><button class="dugme ikincil">Yeni token oluştur</button></form>
</section>`;
  }

  // Ödeme ve hediye EPG kartı (onay bekleyen ve onaylı üyeler)
  if (u.durum === "bekliyor" || k) {
    const kopya = (deger) => `<button type="button" class="kucuk" data-adres="${kac(deger)}" onclick="kopyala(this)"><span>Kopyala</span></button>`;
    const satir = (etiket, deger) => `<div class="bilgi-satir"><div><small>${etiket}</small><b>${kac(deger)}</b></div>${kopya(deger)}</div>`;
    let icerik;
    if (u.odeme) {
      icerik = uyari(`Ödeme bildirimin alındı: ${u.odeme.tutar} TL · ${sureYaz(u.odeme.ay)} (${tarihYaz(u.odeme.tarih)}). Yönetici kontrol edip onaylayacak.`, "bilgi");
    } else if (!env.BANKA_IBAN || !env.BANKA_ALICI) {
      icerik = `<p>Ödeme bilgileri henüz eklenmedi.</p>`;
    } else {
      icerik = `<p>Paketini seç.</p>
<form method="post" class="alanlar" style="margin-top:0"><input type="hidden" name="islem" value="odeme">
<div class="plan-liste" role="radiogroup" aria-label="Ürün tutarı">
${PLANLAR.map((p, i) => `<label class="plan"><input type="radio" name="tutar" value="${p.tutar}"${i === 1 ? " checked" : ""}><span><b>${p.tutar} TL</b><small>${sureYaz(p.ay)} EPG</small></span></label>`).join("")}
</div>
${satir("Alıcı adı", env.BANKA_ALICI)}
${satir("IBAN", env.BANKA_IBAN)}
${satir("Açıklama (aynen yaz)", odemeAciklamasi(u.kadi))}
<button class="dugme">Ödemeyi yaptım</button>
</form>`;
    }
    const baslik = u.durum === "bekliyor" ? "Ödeme" : "Süre uzat";
    bolumler = bolumler.replace("<!--odeme-->", `<section class="kutu">${kutuBas(IKON.kopya, "--vurgu-acik", "--vurgu-yazi", baslik)}${icerik}</section>`);
  }

  // Destek (Telegram botu)
  const bot = await env.EPG.get("telegram-bot");
  if (bot && /^[A-Za-z0-9_]{5,32}$/.test(bot)) {
    bolumler += `<section class="kutu">
${kutuBas(IKON.mesaj, "--vurgu-acik", "--vurgu-yazi", "Destek")}
<p>Sorun yaşarsan ya da bir şey sormak istersen Telegram'dan yaz, en kısa sürede cevap verilir.</p>
<a class="dugme ikincil" href="https://t.me/${bot}" target="_blank" rel="noopener" style="text-decoration:none">${IKON.mesaj}Telegram'dan yaz</a>
</section>`;
  }

  // Şifre değiştir: en altta bir düğme, basınca form açılır
  const geciciGiris = geciciOturum && u.gecici;
  const sifreAcik = geciciGiris || (sifreIslemi && hata);
  bolumler += `<details class="kutu acilir" id="sifre"${sifreAcik ? " open" : ""}>
<summary class="dugme ikincil">${IKON.kilit}Şifre değiştir</summary>
<form method="post" class="alanlar" style="margin-top:4px"><input type="hidden" name="islem" value="sifre">
${geciciGiris ? "" : '<div class="alan"><label for="mevcut">Mevcut şifre</label><input id="mevcut" name="mevcut" type="password" autocomplete="current-password" required></div>'}
<div class="alan"><label for="yeni">Yeni şifre</label><input id="yeni" name="yeni" type="password" autocomplete="new-password" required minlength="8" maxlength="100"></div>
<div class="alan"><label for="yeni2">Yeni şifre (tekrar)</label><input id="yeni2" name="yeni2" type="password" autocomplete="new-password" required></div>
<button class="dugme">Şifreyi değiştir</button>
</form></details>`;

  return html(uyeSablon("Panel", `${ustBar}
<main class="icerik">
<div class="selam">Merhaba,<h1>${kac(u.kadi)}</h1></div>
${uyari(mesaj, hata ? "hata" : "iyi")}
${url.searchParams.has("m") ? '<script>history.replaceState(null,"","/panel")</script>' : ""}
${u.gecici ? uyari("Geçici şifreyle giriş yaptın. Lütfen aşağıdan kendi şifreni belirle.", "hata") : ""}
${bolumler}
</main>`), hata ? 400 : 200);
}
