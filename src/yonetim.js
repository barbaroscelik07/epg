// Yönetim sayfası (yalnızca yönetici şifresiyle)
import {
  KUL, UYE, metin, html, git, bugun, simdi, ayEkle, kalanGun, durum, DURUM_YAZI, rastgele, bosKodBul,
  kac, esit, adresi, kaydet, uyeAl, uyeKaydet, listele, sifreOzetle, ayniSite,
} from "./ortak.js";
import { uyeSablon, marka, uyari, tarihYaz, IKON } from "./gorunum.js";

const KOD = /^[A-Za-z0-9_-]{6,64}$/;
const KADI = /^[a-z0-9_.]{3,20}$/;

export async function yonetim(request, env, url) {
  if (!env.YONETIM_SIFRESI) return metin("Yonetim sifresi ayarlanmamis (GitHub secret: YONETIM_SIFRESI)", 503);
  const auth = request.headers.get("authorization") || "";
  let sifre = "";
  if (auth.startsWith("Basic ")) {
    try { sifre = atob(auth.slice(6)).split(":").slice(1).join(":"); } catch { sifre = ""; }
  }
  if (!esit(sifre, env.YONETIM_SIFRESI)) {
    return new Response("Sifre gerekli", { status: 401, headers: { "www-authenticate": 'Basic realm="EPG yonetim", charset="UTF-8"' } });
  }

  if (request.method === "POST") {
    if (!ayniSite(request, url)) return metin("Gecersiz istek", 403);
    const f = await request.formData();
    const islem = String(f.get("islem") || "");
    const ay = f.get("sure") === "12" ? 12 : 6;

    if (islem === "ekle") {
      const ad = String(f.get("ad") || "").trim().slice(0, 60);
      if (!ad) return yonlendir("Ad boş olamaz");
      const yeni = await bosKodBul(env);
      await kaydet(env, yeni, { ad, bitis: ayEkle(bugun(), ay), aktif: true, olusturma: bugun() });
      return yonlendir(`${ad} eklendi`, yeni);
    }
    if (islem === "acik") {
      await env.EPG.put("acik-erisim", f.get("durum") === "kapat" ? "kapali" : "acik");
      return yonlendir("Herkese açık adres ayarı kaydedildi");
    }

    // Üyelik işlemleri (kullanıcı adına göre)
    if (["onayla", "reddet", "sifirla"].includes(islem)) {
      const kadi = String(f.get("kadi") || "");
      const u = KADI.test(kadi) ? await uyeAl(env, kadi) : null;
      if (!u) return yonlendir("Üye bulunamadı");
      if (islem === "onayla") {
        if (u.durum !== "bekliyor") return yonlendir(`${kadi} zaten onaylı`);
        const kod = await bosKodBul(env);
        await kaydet(env, kod, { ad: kadi, bitis: ayEkle(bugun(), ay), aktif: true, olusturma: bugun(), uye: kadi });
        u.durum = "onayli"; u.kod = kod;
        await uyeKaydet(env, u);
        return yonlendir(`${kadi} onaylandı (${ay === 12 ? "1 yıl" : "6 ay"})`);
      }
      if (islem === "reddet") {
        await env.EPG.delete(UYE + kadi);
        return yonlendir(`${kadi} reddedildi ve silindi`);
      }
      // sifirla: geçici şifre üret ve yalnızca bu ekranda göster (adres çubuğuna yazılmaz)
      const gecici = rastgele(8);
      Object.assign(u, await sifreOzetle(gecici));
      u.gecici = true; u.sifirlama = null;
      await uyeKaydet(env, u);
      return sayfaGoster(env, url, "", "", { kadi, sifre: gecici });
    }

    // EPG erişimi işlemleri (koda göre)
    const kod = String(f.get("kod") || "");
    const k = KOD.test(kod) ? await env.EPG.get(KUL + kod, { type: "json" }) : null;
    if (!k) return yonlendir("Kişi bulunamadı");
    let mesaj = "";
    if (islem === "uzat") {
      k.bitis = ayEkle(k.bitis > bugun() ? k.bitis : bugun(), ay);
      k.aktif = true;
      await kaydet(env, kod, k);
      mesaj = `${k.ad}: yeni bitiş ${k.bitis}`;
    } else if (islem === "durdur") {
      k.aktif = false; await kaydet(env, kod, k); mesaj = `${k.ad} durduruldu`;
    } else if (islem === "ac") {
      k.aktif = true; await kaydet(env, kod, k); mesaj = `${k.ad} yeniden açıldı`;
    } else if (islem === "sil") {
      await env.EPG.delete(KUL + kod);
      if (k.uye) await env.EPG.delete(UYE + k.uye); // üyelik hesabı da silinir
      mesaj = `${k.ad} silindi`;
    }
    return yonlendir(mesaj);
  }

  return sayfaGoster(env, url, url.searchParams.get("m") || "", url.searchParams.get("yeni") || "");
}

function yonlendir(mesaj, yeniKod = "") {
  const q = new URLSearchParams({ m: mesaj });
  if (yeniKod) q.set("yeni", yeniKod);
  return git("/yonetim?" + q);
}

async function sayfaGoster(env, url, mesaj, yeniKod = "", gecici = null) {
  const [kisiler, uyeler, acikDeger] = await Promise.all([listele(env, KUL), listele(env, UYE), env.EPG.get("acik-erisim")]);
  const bekleyen = uyeler.filter((u) => u.durum === "bekliyor");
  const sifirlama = uyeler.filter((u) => u.sifirlama);
  return html(sayfa(url.origin, kisiler, bekleyen, sifirlama, acikDeger !== "kapali", mesaj, yeniKod, gecici));
}

const YAKLASAN_GUN = 14;

function sayfa(origin, kisiler, bekleyen, sifirlama, acik, mesaj, yeniKod, gecici) {
  const form = (alanlar, yazi, sinif = "kucuk", onay = "") =>
    `<form method="post"${onay ? ` onsubmit="return confirm('${kac(onay)}')"` : ""}>${Object.entries(alanlar)
      .map(([a, v]) => `<input type="hidden" name="${a}" value="${kac(v)}">`).join("")}<button class="${sinif}">${yazi}</button></form>`;
  const kopyaDugme = (deger, yazi = "Kopyala") =>
    `<button type="button" class="kucuk" data-adres="${kac(deger)}" onclick="kopyala(this)">${IKON.kopyaK}<span>${yazi}</span></button>`;

  // Kişileri hazırla: durum, kalan gün, yaklaşan
  const liste = kisiler.map((k) => {
    const d = durum(k);
    const kalan = kalanGun(k.bitis);
    const yaklasan = d === "aktif" && kalan <= YAKLASAN_GUN;
    return { ...k, d, kalan, yaklasan };
  }).sort((a, b) => (a.d === "aktif" ? 0 : 1) - (b.d === "aktif" ? 0 : 1) || a.bitis.localeCompare(b.bitis));
  const say = {
    aktif: liste.filter((k) => k.d === "aktif").length,
    yaklasan: liste.filter((k) => k.yaklasan).length,
    bitti: liste.filter((k) => k.d !== "aktif").length,
  };

  const kart = (k) => {
    const rozet = k.yaklasan ? `<span class="rozet bekliyor">${k.kalan} gün kaldı</span>` : `<span class="rozet ${k.d}">${DURUM_YAZI[k.d]}</span>`;
    const alt = [k.uye ? `Üye: ${kac(k.uye)}` : "Üyeliksiz", `Bitiş: ${tarihYaz(k.bitis)}${k.d === "aktif" && !k.yaklasan ? ` · ${k.kalan} gün` : ""}`]
      .concat(k.sonYenileme ? [`Son token yenileme: ${tarihYaz(k.sonYenileme)}`] : []).join(" · ");
    const durumlar = [k.d, k.yaklasan ? "yaklasan" : "", k.d !== "aktif" ? "bitti" : ""].join(" ").trim();
    const aranan = `${k.ad} ${k.uye || ""}`.toLocaleLowerCase("tr");
    return `<section class="kutu" data-kisi data-durum="${durumlar}" data-ara="${kac(aranan)}">
<div class="kisi-ust"><div><div class="kisi-ad">${kac(k.ad)}</div><div class="kisi-alt">${alt}</div></div>${rozet}</div>
<div class="adres-satir"><div class="adres">${kac(adresi(origin, k.anahtar, k.uye))}</div>${kopyaDugme(adresi(origin, k.anahtar, k.uye))}</div>
<div class="satir">
${form({ islem: "uzat", kod: k.anahtar, sure: "6" }, `${IKON.arti}6 ay`, "kucuk ana")}
${form({ islem: "uzat", kod: k.anahtar, sure: "12" }, `${IKON.arti}1 yıl`, "kucuk ana")}
${k.aktif ? form({ islem: "durdur", kod: k.anahtar }, "Durdur") : form({ islem: "ac", kod: k.anahtar }, "Yeniden aç")}
${k.uye ? form({ islem: "sifirla", kadi: k.uye }, "Şifre sıfırla", "kucuk", `${k.uye} için geçici şifre oluşturulsun mu? Mevcut şifresi çalışmaz.`) : ""}
${form({ islem: "sil", kod: k.anahtar }, "Sil", "kucuk tehlike", `${k.ad} silinsin mi? Adresi bir daha çalışmaz${k.uye ? ", üyelik hesabı da silinir" : ""}.`)}
</div></section>`;
  };

  const bekleyenHtml = bekleyen.map((u) => `<section class="kutu">
<div class="kisi-ust"><div><div class="kisi-ad">${kac(u.kadi)}</div><div class="kisi-alt">Kayıt: ${tarihYaz(u.kayit)}</div></div><span class="rozet bekliyor">Onay bekliyor</span></div>
<div class="satir">
${form({ islem: "onayla", kadi: u.kadi, sure: "6" }, "Onayla · 6 ay", "kucuk ana")}
${form({ islem: "onayla", kadi: u.kadi, sure: "12" }, "Onayla · 1 yıl", "kucuk ana")}
${form({ islem: "reddet", kadi: u.kadi }, "Reddet", "kucuk tehlike", `${u.kadi} reddedilip silinsin mi?`)}
</div></section>`).join("\n");

  const sifirlamaHtml = sifirlama.map((u) => `<section class="kutu">
<div class="kisi-ust"><div><div class="kisi-ad">${kac(u.kadi)}</div><div class="kisi-alt">İstek: ${tarihYaz(u.sifirlama)}</div></div><span class="rozet bekliyor">Şifresini unuttu</span></div>
<div class="satir">${form({ islem: "sifirla", kadi: u.kadi }, "Geçici şifre oluştur", "kucuk ana")}</div></section>`).join("\n");

  const geciciKutu = gecici ? `<section class="kutu" style="border-color:var(--vurgu)">
<div class="kutu-bas"><span class="kutu-ikon" style="background:var(--vurgu-acik);color:var(--vurgu-yazi)">${IKON.kilit}</span><h2>${kac(gecici.kadi)} için geçici şifre</h2></div>
<div class="adres-satir"><div class="adres sifre-goster">${kac(gecici.sifre)}</div>${kopyaDugme(gecici.sifre)}</div>
<p>Bu şifreyi kişiye ilet. Girişten sonra kendi şifresini belirlemesi istenecek. Sayfa yenilenince bu şifre bir daha gösterilmez.</p>
</section>` : "";

  const yeniKutu = yeniKod ? `<section class="kutu" style="border-color:var(--vurgu)">
<div class="kutu-bas"><span class="kutu-ikon" style="background:var(--vurgu-acik);color:var(--vurgu-yazi)">${IKON.link}</span><h2>Yeni EPG adresi</h2></div>
<div class="adres-satir"><div class="adres">${kac(adresi(origin, yeniKod))}</div>${kopyaDugme(adresi(origin, yeniKod))}</div>
<p>Bu adres IPTV uygulamasına EPG kaynağı olarak girilecek.</p></section>` : "";

  const ozet = `<div class="ozet">
<a href="#kisiler" onclick="filtre(document.querySelector('[data-f=aktif]'))"><b>${say.aktif}</b><span>Aktif</span></a>
<a href="#bekleyenler"><b>${bekleyen.length}</b><span>Onay bekleyen</span></a>
<a href="#kisiler" onclick="filtre(document.querySelector('[data-f=yaklasan]'))"><b>${say.yaklasan}</b><span>${YAKLASAN_GUN} gün içinde bitecek</span></a>
<a href="#kisiler" onclick="filtre(document.querySelector('[data-f=bitti]'))"><b>${say.bitti}</b><span>Süresi dolan / durdurulan</span></a>
</div>`;

  return uyeSablon("Yönetim", `<header class="ust-bar"><div class="genis">${marka(20, "/yonetim", ' <span style="font-weight:600;color:var(--soluk)">· Yönetim</span>')}</div></header>
<main class="icerik genis">
${uyari(mesaj, "iyi")}
${geciciKutu}
${yeniKutu}
${ozet}

${bekleyen.length ? `<div class="bolum-bas" id="bekleyenler"><h2>Onay bekleyenler<span class="sayi">${bekleyen.length}</span></h2></div>${bekleyenHtml}` : '<span id="bekleyenler"></span>'}
${sifirlama.length ? `<div class="bolum-bas"><h2>Şifre sıfırlama istekleri<span class="sayi">${sifirlama.length}</span></h2></div>${sifirlamaHtml}` : ""}

<div class="bolum-bas" id="kisiler"><h2>Kişiler<span class="sayi">${liste.length}</span></h2></div>
<input id="ara" class="ara" type="search" placeholder="Ad ya da kullanıcı adı ara" aria-label="Kişi ara" oninput="suz()">
<div class="filtre" role="group" aria-label="Duruma göre süz">
<button type="button" data-f="hepsi" aria-pressed="true" onclick="filtre(this)">Tümü</button>
<button type="button" data-f="aktif" aria-pressed="false" onclick="filtre(this)">Aktif</button>
<button type="button" data-f="yaklasan" aria-pressed="false" onclick="filtre(this)">Yakında bitecek</button>
<button type="button" data-f="bitti" aria-pressed="false" onclick="filtre(this)">Dolan / durdurulan</button>
</div>
${liste.map(kart).join("\n") || '<div class="kutu bos">Henüz kimse yok.</div>'}
<div class="kutu bos" id="sonuc-yok" hidden>Bu aramaya uyan kişi yok.</div>
<p class="ipucu">Yeni kayıtlar ve değişiklikler listede ve adreste 1 dakikaya kadar gecikmeyle görünebilir.</p>

<div class="bolum-bas"><h2>Ekle ve paylaş</h2></div>
<section class="kutu">
<div class="kutu-bas"><span class="kutu-ikon" style="background:var(--vurgu-acik);color:var(--vurgu-yazi)">${IKON.link}</span><h2>Üye kayıt adresi</h2></div>
<p>Üye olmak isteyenlere bu adresi gönder. Kayıt olanlar yukarıda onay bekler.</p>
<div class="adres-satir"><div class="adres">${kac(origin)}/kayit</div>${kopyaDugme(origin + "/kayit")}</div>
</section>
<section class="kutu">
<div class="kutu-bas"><span class="kutu-ikon" style="background:var(--gri-acik);color:var(--gri)">${IKON.arti}</span><h2>Üyeliksiz kişi ekle</h2></div>
<p>Hesap açmadan doğrudan EPG adresi verir. Kişi panel kullanamaz, token'ını kendisi yenileyemez.</p>
<form method="post" class="ekle-satir"><input type="hidden" name="islem" value="ekle">
<input name="ad" placeholder="Ad (ör. Kardeşim)" required maxlength="60" aria-label="Ad">
<select name="sure" aria-label="Süre"><option value="6">6 ay</option><option value="12">1 yıl</option></select>
<button class="dugme">Ekle</button></form>
</section>
<section class="kutu">
<div class="kisi-ust"><div><div class="kisi-ad">Herkese açık eski adres</div><div class="kisi-alt">${kac(origin)}/guide.xml.gz</div></div><span class="rozet ${acik ? "bekliyor" : "aktif"}">${acik ? "Açık" : "Kapalı"}</span></div>
<p>${acik ? "Bu adresi bilen herkes süre sınırı olmadan EPG alabilir. Herkes kişisel adresine geçtiyse kapat." : "Kapalı. Yalnızca kişisel adresler çalışıyor."}</p>
<div class="satir">${form({ islem: "acik", durum: acik ? "kapat" : "ac" }, acik ? "Kapat" : "Aç", acik ? "kucuk ana" : "kucuk")}</div>
</section>
</main>`);
}
