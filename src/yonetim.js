// Yönetim sayfası (yalnızca yönetici şifresiyle)
import {
  KUL, UYE, metin, html, git, bugun, simdi, ayEkle, kalanGun, durum, DURUM_YAZI, rastgele, bosKodBul,
  kac, esit, adresi, kaydet, uyeAl, uyeKaydet, listele, sifreOzetle, ayniSite, sablon, mesajKutusu, adresKutusu,
} from "./ortak.js";

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
      return sayfaGoster(env, url, `${kadi} için geçici şifre: ${gecici}  —  Bunu kişiye iletin; girişten sonra kendi şifresini belirlemesi istenecek.`);
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

async function sayfaGoster(env, url, mesaj, yeniKod = "") {
  const [kisiler, uyeler, acikDeger] = await Promise.all([listele(env, KUL), listele(env, UYE), env.EPG.get("acik-erisim")]);
  kisiler.sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  const bekleyen = uyeler.filter((u) => u.durum === "bekliyor");
  const sifirlama = uyeler.filter((u) => u.sifirlama);
  return html(sayfa(url.origin, kisiler, bekleyen, sifirlama, acikDeger !== "kapali", mesaj, yeniKod));
}

function sayfa(origin, kisiler, bekleyen, sifirlama, acik, mesaj, yeniKod) {
  const form = (alanlar, yazi, onay = "", sinif = "") =>
    `<form method="post"${onay ? ` onsubmit="return confirm('${kac(onay)}')"` : ""}>${Object.entries(alanlar)
      .map(([a, v]) => `<input type="hidden" name="${a}" value="${kac(v)}">`).join("")}<button${sinif ? ` class="${sinif}"` : ""}>${yazi}</button></form>`;

  const bekleyenHtml = bekleyen.map((u) => `<div class="kart bekliyor">
  <div class="ust"><b>${kac(u.kadi)}</b><span class="rozet">Onay bekliyor</span></div>
  <div class="soluk">Kayıt: ${kac(u.kayit)}</div>
  <div class="butonlar" style="margin-top:8px">
    ${form({ islem: "onayla", kadi: u.kadi, sure: "6" }, "Onayla (6 ay)")}
    ${form({ islem: "onayla", kadi: u.kadi, sure: "12" }, "Onayla (1 yıl)")}
    ${form({ islem: "reddet", kadi: u.kadi }, "Reddet", `${u.kadi} reddedilip silinsin mi?`, "ikincil")}
  </div></div>`).join("\n");

  const sifirlamaHtml = sifirlama.map((u) => `<div class="kart bekliyor">
  <div class="ust"><b>${kac(u.kadi)}</b><span class="rozet">Şifre unuttu</span></div>
  <div class="soluk">İstek: ${kac(u.sifirlama)}</div>
  <div class="butonlar" style="margin-top:8px">${form({ islem: "sifirla", kadi: u.kadi }, "Geçici şifre oluştur")}</div></div>`).join("\n");

  const kisilerHtml = kisiler.map((k) => {
    const d = durum(k);
    return `<div class="kart ${d}">
  <div class="ust"><b>${kac(k.ad)}</b><span class="rozet">${DURUM_YAZI[d]}</span></div>
  <div>Bitiş: ${kac(k.bitis)}${d === "aktif" ? ` (${kalanGun(k.bitis)} gün kaldı)` : ""}</div>
  ${k.uye ? `<div class="soluk">Üye: ${kac(k.uye)}${k.sonYenileme ? ` · Son token yenileme: ${kac(k.sonYenileme)}` : ""}</div>` : ""}
  ${adresKutusu(adresi(origin, k.anahtar))}
  <div class="butonlar">
    ${form({ islem: "uzat", kod: k.anahtar, sure: "6" }, "+6 ay")}
    ${form({ islem: "uzat", kod: k.anahtar, sure: "12" }, "+1 yıl")}
    ${k.aktif ? form({ islem: "durdur", kod: k.anahtar }, "Durdur") : form({ islem: "ac", kod: k.anahtar }, "Yeniden aç")}
    ${k.uye ? form({ islem: "sifirla", kadi: k.uye }, "Şifre sıfırla", `${k.uye} için geçici şifre oluşturulsun mu? Mevcut şifresi çalışmaz.`, "ikincil") : ""}
    ${form({ islem: "sil", kod: k.anahtar }, "Sil", `${k.ad} silinsin mi? Adresi bir daha çalışmaz${k.uye ? ", üyelik hesabı da silinir" : ""}.`, "ikincil")}
  </div>
</div>`;
  }).join("\n");

  const yeniKutu = yeniKod ? `<div class="yeni">Yeni adres (TiviMate'e bunu girin):${adresKutusu(adresi(origin, yeniKod))}</div>` : "";

  return sablon("EPG Yönetim", `<h1>EPG Yönetim</h1>
${mesajKutusu(mesaj)}
${yeniKutu}
${bekleyen.length ? `<h2>Onay bekleyenler (${bekleyen.length})</h2>${bekleyenHtml}` : ""}
${sifirlama.length ? `<h2>Şifre sıfırlama istekleri (${sifirlama.length})</h2>${sifirlamaHtml}` : ""}
<div class="panel"><b>Yeni kişi (üyeliksiz)</b>
<form method="post" class="ekle"><input type="hidden" name="islem" value="ekle">
<input name="ad" placeholder="Ad (ör. Kardeşim)" required maxlength="60">
<select name="sure"><option value="6">6 ay</option><option value="12">1 yıl</option></select>
<button>Ekle</button></form></div>
<h2>Kişiler (${kisiler.length})</h2>
${kisilerHtml || '<p class="soluk">Henüz kimse yok.</p>'}
<p class="soluk">Yeni kayıtlar ve değişiklikler listede ve adreste 1 dakikaya kadar gecikmeyle görünebilir.
Üye olmak isteyenlere şu adresi verin: <a href="/kayit">${kac(origin)}/kayit</a></p>
<h2>Herkese açık eski adres</h2>
<div class="panel">${kac(origin)}/guide.xml.gz : <b>${acik ? "Açık" : "Kapalı"}</b>
<div style="margin-top:8px">${form({ islem: "acik", durum: acik ? "kapat" : "ac" }, acik ? "Kapat" : "Aç")}</div></div>`);
}
