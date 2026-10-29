// Herkese açık sayfalar: ana sayfa (/) ve kurulum rehberi (/kurulum)
import { html } from "./ortak.js";
import { uyeSablon, IKON } from "./gorunum.js";

const STIL = `<style>
.tn-ust{position:sticky;top:0;z-index:5;background:var(--kart);border-bottom:1px solid var(--cizgi)}
.tn-ust>div{max-width:1040px;margin:0 auto;height:64px;padding:0 20px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.tn-ust nav{display:flex;align-items:center;gap:6px}
.tn-ust nav a{font-size:15px;padding:8px 10px;border-radius:10px;color:var(--yazi);font-weight:600}
.tn-ust nav a:hover{background:var(--zemin);text-decoration:none}
.tn-ust nav a.ana{background:var(--vurgu);color:#fff;padding:8px 14px}.tn-ust nav a.ana:hover{background:var(--vurgu-koyu)}
@media (max-width:520px){.tn-ust nav a.gizle{display:none}}
.tn{max-width:1040px;margin:0 auto;padding:0 20px}
.kahraman{display:grid;grid-template-columns:minmax(0,1fr);gap:28px;align-items:center;padding:44px 0 28px}
@media (min-width:880px){.kahraman{grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);padding:72px 0 48px}}
.kahraman h1{font-size:clamp(32px,6vw,50px);line-height:1.08;font-weight:800;letter-spacing:-.035em}
.kahraman h1 span{color:var(--vurgu-yazi)}
.kahraman p{margin:16px 0 0;font-size:17px;color:var(--soluk);max-width:520px}
.dugmeler{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}
.dugmeler .dugme{width:auto;padding:0 24px;text-decoration:none}
.dugmeler .dugme.ikincil{height:54px}
.ep{background:#0F172A;color:#E6EAF2;border-radius:22px;padding:14px;border:1px solid #1F2A40;box-shadow:0 20px 50px rgba(15,23,42,.25);overflow:hidden}
.ep-ust{display:flex;gap:12px;align-items:flex-start;padding:6px 6px 14px}
.ep-canli{flex:none;font-size:12px;font-weight:800;padding:4px 10px;border-radius:99px;background:#EF4444;color:#fff;margin-top:2px}
.ep-ust b{display:block;font-size:17px}.ep-ust small{display:block;font-size:12px;color:#93A3BC;margin-top:2px}
.ep-ust p{margin:6px 0 0;font-size:13px;color:#B8C3D6;line-height:1.45}
.ep-izgara{position:relative;display:grid;grid-template-columns:96px repeat(5,minmax(0,1fr));gap:4px;font-size:12px}
.ep-saat{color:#93A3BC;font-weight:600;padding:2px 4px}
.ep-kanal{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;background:transparent;border-radius:8px;padding:4px 8px;min-height:40px}
.ep-kanal img{max-width:100%;max-height:28px;object-fit:contain}
.ep-prog{position:relative;z-index:1;background:#1B2740;border-radius:8px;padding:6px 8px;min-height:40px;overflow:hidden;display:flex;flex-direction:column;justify-content:center}
.ep-prog b{font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ep-prog small{font-size:10px;color:#93A3BC}
.ep-prog.sec{background:#2563EB}.ep-prog.sec small{color:#DCE7FF}
.ep-cizgi{position:absolute;z-index:0;top:22px;bottom:0;left:calc(96px + (100% - 96px) * .54);width:2px;background:#EF4444;pointer-events:none}
.ep-cizgi::before{content:"";position:absolute;top:-5px;left:-4px;width:10px;height:10px;border-radius:5px;background:#EF4444}
@media (max-width:480px){.ep{padding:10px}.ep-izgara{grid-template-columns:72px repeat(5,minmax(0,1fr));gap:3px}.ep-cizgi{left:calc(72px + (100% - 72px) * .54)}.ep-prog{padding:4px 5px}.ep-prog small{display:none}.ep-prog b{font-size:11px}.ep-kanal{padding:3px 5px}.ep-kanal img{max-height:22px}.ep-saat{font-size:10px;padding:2px 1px}}
.vitrin{margin-top:26px;border-radius:24px;overflow:hidden;background:radial-gradient(120% 90% at 15% 0%,#1E40AF 0%,transparent 55%),radial-gradient(90% 80% at 100% 100%,#0E7490 0%,transparent 55%),#0B1224;border:1px solid #1F2A40;box-shadow:0 20px 50px rgba(15,23,42,.25)}
.vitrin-ic{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:26px 34px;padding:38px 28px}
.vitrin img{height:46px;max-width:120px;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(0,0,0,.35))}
@media (max-width:520px){.vitrin-ic{gap:18px 22px;padding:26px 16px}.vitrin img{height:32px;max-width:84px}}
.sayilar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:8px 0 8px}
.sayilar div{background:var(--kart);border:1px solid var(--cizgi);border-radius:16px;padding:16px;text-align:center}
.sayilar b{display:block;font-size:clamp(19px,5vw,30px);font-weight:800;letter-spacing:-.02em;white-space:nowrap}
.sayilar span{font-size:13px;color:var(--soluk)}
.bolum{padding:44px 0 8px}
.bolum>h2{font-size:clamp(24px,4vw,32px);font-weight:800;letter-spacing:-.03em;text-align:center}
.bolum>p.alt{margin:8px auto 0;text-align:center;color:var(--soluk);max-width:560px}
.izgara{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:26px}
.ozellik{background:var(--kart);border:1px solid var(--cizgi);border-radius:20px;padding:22px;display:flex;flex-direction:column;gap:10px}
.ozellik h3{margin:0;font-size:17px;font-weight:700}.ozellik p{margin:0;font-size:15px;color:var(--soluk)}
.adimlar{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-top:26px;counter-reset:a}
.adimlar div{background:var(--kart);border:1px solid var(--cizgi);border-radius:20px;padding:22px;position:relative}
.adimlar div::before{counter-increment:a;content:counter(a);display:flex;width:36px;height:36px;border-radius:18px;background:var(--vurgu);color:#fff;font-weight:800;align-items:center;justify-content:center;margin-bottom:12px}
.adimlar h3{margin:0 0 6px;font-size:16px}.adimlar p{margin:0;font-size:14px;color:var(--soluk)}
.etiketler{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:22px}
.etiketler span{padding:10px 16px;border-radius:99px;background:var(--kart);border:1px solid var(--cizgi);font-weight:700;font-size:15px}
.cagri{margin:44px 0 0;background:var(--vurgu);color:#fff;border-radius:24px;padding:32px 24px;text-align:center}
.cagri h2{font-size:clamp(22px,4vw,30px);font-weight:800;color:#fff}.cagri p{margin:8px 0 18px;opacity:.92}
.cagri a{display:inline-flex;height:52px;align-items:center;padding:0 24px;border-radius:14px;background:#fff;color:#1D4ED8;font-weight:800}
.tn-alt{margin-top:44px;border-top:1px solid var(--cizgi);padding:24px 20px 36px;text-align:center;font-size:14px;color:var(--soluk2)}
.tn-alt a{margin:0 8px}
/* kurulum */
.rehber{max-width:760px;margin:0 auto;padding:32px 20px 0}
.rehber h1{font-size:clamp(28px,5vw,38px);font-weight:800;letter-spacing:-.03em}
.rehber>p{color:var(--soluk)}
details.uyg{background:var(--kart);border:1px solid var(--cizgi);border-radius:18px;margin-top:12px}
details.uyg summary{list-style:none;cursor:pointer;padding:18px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-weight:800;font-size:17px}
details.uyg summary::-webkit-details-marker{display:none}
details.uyg summary::after{content:"+";font-size:22px;color:var(--soluk)}details.uyg[open] summary::after{content:"−"}
details.uyg>div{padding:0 20px 20px}
details.uyg ol{margin:0;padding-left:22px;display:flex;flex-direction:column;gap:8px}
details.uyg li{line-height:1.5}
.kaynak{margin-top:12px;font-size:13px;color:var(--soluk2);overflow-wrap:anywhere}
.rozet-k{display:inline-block;font-size:12px;font-weight:700;padding:3px 8px;border-radius:99px;margin-left:6px;vertical-align:2px}
.rozet-k.dogru{background:var(--iyi-z);color:var(--iyi-y)}.rozet-k.belirsiz{background:var(--bekle-z);color:var(--bekle-y)}
code{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;background:var(--zemin);border:1px solid var(--cizgi);border-radius:6px;padding:1px 6px;word-break:break-all}
</style>`;

const UST = (aktif) => `<header class="tn-ust"><div>
<a class="marka" href="/"><span class="logo">${IKON.logo(24)}</span>EPG Deposu</a>
<nav aria-label="Ana menü">
<a href="/kurulum" class="gizle"${aktif === "kurulum" ? ' aria-current="page"' : ""}>Kurulum</a>
<a href="/giris">Giriş</a>
<a href="/kayit" class="ana">Üye ol</a>
</nav></div></header>`;

const ALT = `<footer class="tn-alt"><a href="/kurulum">Kurulum rehberi</a>·<a href="/giris">Giriş</a>·<a href="/kayit">Üye ol</a>
<div style="margin-top:10px">EPG Deposu · Türk kanalları için yayın akışı</div><div style="margin-top:6px;font-size:12px">Kanal adları ve logoları ilgili yayıncılara aittir.</div></footer>`;

// Yayın akışı görseli: gerçek kanal logoları (/logo/), program adları örnek
const EKRAN = (() => {
  const saatler = ["20:00", "20:30", "21:00", "21:30", "22:00"];
  // [kanal, renk, [[program, başlangıç (yarım saat), süre (yarım saat)], ...]]
  const satirlar = [
    ["TRT 1", "TRT1.tr.png", [["Haber", 0, 1], ["Yerli Dizi", 1, 4]]],
    ["Show TV", "ShowTV.tr.png", [["Yarışma", 0, 2], ["Yeni Bölüm", 2, 3]]],
    ["ATV", "ATV.tr.png", [["Haber", 0, 1], ["Dizi · 12. Bölüm", 1, 4]]],
    ["Kanal D", "KanalD.tr.png", [["Haber", 0, 1], ["Akşam Kuşağı", 1, 2], ["Dizi", 3, 2]]],
    ["TRT Spor", "TRTSpor.tr.png", [["Özet", 0, 1], ["Canlı Maç", 1, 4]]],
    ["Star TV", "StarTV.tr.png", [["Film: Gece Yolculuğu", 0, 3], ["Dizi", 3, 2]]],
  ];
  const secili = [1, 1]; // satır 1, program 1 seçili görünür
  const kutu = (ad, b, sure, sec) =>
    `<div class="ep-prog${sec ? " sec" : ""}" style="grid-column:${b + 2} / span ${sure}"><b>${ad}</b><small>${saatler[b] || "22:30"}</small></div>`;
  return `<div class="ep" role="img" aria-label="Örnek yayın akışı: TRT 1, Show TV, ATV, Kanal D, TRT Spor ve Star TV kanallarının akşam programları">
<div class="ep-ust"><span class="ep-canli">Şimdi</span><div><b>Yeni Bölüm</b><small>21:00 – 22:30 · Show TV</small><p>Programın açıklaması burada görünür: konu, oyuncular, bölüm bilgisi.</p></div></div>
<div class="ep-izgara">
<div class="ep-bos"></div>${saatler.map((t) => `<div class="ep-saat">${t}</div>`).join("")}
${satirlar.map(([k, l, ps], i) => `<div class="ep-kanal"><img src="/logo/${l}" alt="${k}"></div>${ps.map(([ad, b, sure], j) => kutu(ad, b, sure, i === secili[0] && j === secili[1])).join("")}`).join("\n")}
<div class="ep-cizgi" aria-hidden="true"></div>
</div></div>`;
})();

// Popüler ücretsiz (şifresiz) kanallar: tek görselde, logolar kutusuz (şeffaf zemin)
const POPULER = [
  ["TRT 1", "TRT1.tr.png"],
  ["Show TV", "ShowTV.tr.png"],
  ["Kanal D", "KanalD.tr.png"],
  ["ATV", "ATV.tr.png"],
  ["NOW", "NOW.tr.png"],
  ["Star TV", "StarTV.tr.png"],
  ["TV8", "TV8.tr.png"],
  ["Kanal 7", "Kanal7.tr.png"],
  ["Beyaz TV", "BeyazTV.tr.png"],
  ["Teve2", "Teve2.tr.png"],
  ["TRT 2", "TRT2.tr.png"],
  ["360", "360.tr.png"],
  ["TRT Haber", "TRTHaber.tr.png"],
  ["NTV", "NTV.tr.png"],
  ["CNN Türk", "CNNTurk.tr.png"],
  ["Habertürk", "HaberturkTV.tr.png"],
  ["A Haber", "AHaber.tr.png"],
  ["Halk TV", "HalkTV.tr.png"],
  ["Sözcü TV", "SozcuTV.tr.png"],
  ["TRT Spor", "TRTSpor.tr.png"],
  ["A Spor", "ASpor.tr.png"],
  ["TRT Çocuk", "TRTCocuk.tr.png"],
  ["TRT Belgesel", "TRTBelgesel.tr.png"],
  ["DMAX", "DMAX.tr.png"],
];
const KANALLAR = `<div class="vitrin" role="img" aria-label="Popüler kanallar: ${POPULER.map(([k]) => k).join(", ")}">
<div class="vitrin-ic">${POPULER.map(([k, l]) => `<img src="/logo/${l}" alt="" title="${k}" loading="lazy">`).join("")}</div></div>`;

// acikKayit: ücretsiz dönem açık (kayıt onaysız açılır; ödeme ve onay adımları gösterilmez)
export function anaSayfa(acikKayit = false) {
  return html(uyeSablon("Türk kanalları için yayın akışı", `${STIL}${UST("ana")}
<main class="tn">
<section class="kahraman">
<div>
<h1>Türk kanalları için <span>yayın akışı</span>, tek adreste.</h1>
<p>IPTV uygulamana kişisel EPG adresini ekle; ulusal, haber, spor, belgesel, çocuk ve sinema kanallarının program akışı kanal logoları ve açıklamalarıyla gelsin.</p>
<div class="dugmeler"><a class="dugme" href="/kayit">Hemen üye ol</a><a class="dugme ikincil" href="/kurulum">Nasıl kurulur?</a></div>
</div>
<div>${EKRAN}</div>
</section>

<div class="sayilar">
<div><b>240</b><span>kanallık liste</span></div>
<div><b>Günde 2</b><span>güncelleme</span></div>
<div><b>3–7 gün</b><span>ileri yayın akışı</span></div>
</div>

<section class="bolum">
<h2>Popüler kanallar</h2>
<p class="alt">Listede toplam 240 kanal bulunuyor.</p>
${KANALLAR}
</section>

<section class="bolum">
<h2>Neler var?</h2>
<p class="alt">Yayın akışı birden fazla kaynaktan derlenir, günde iki kez güncellenir.</p>
<div class="izgara">
<div class="ozellik"><span class="kutu-ikon" style="background:var(--vurgu-acik);color:var(--vurgu-yazi)">${IKON.logo(18).replace('stroke="#FFFFFF"', 'stroke="currentColor"')}</span><h3>Geniş kanal listesi</h3><p>Ulusal, haber, spor, belgesel, çocuk, müzik ve sinema kanalları.</p></div>
<div class="ozellik"><span class="kutu-ikon" style="background:var(--iyi-z);color:var(--iyi-y)">${IKON.tamam}</span><h3>Logolar ve açıklamalar</h3><p>Kanal logoları ve programların açıklamaları, uygun olan kanallarda.</p></div>
<div class="ozellik"><span class="kutu-ikon" style="background:var(--turuncu-acik);color:var(--turuncu)">${IKON.yenile}</span><h3>Kişisel adres</h3><p>Sana özel EPG adresi. Başkasının eline geçerse panelinden tek dokunuşla yenilersin.</p></div>
<div class="ozellik"><span class="kutu-ikon" style="background:var(--gri-acik);color:var(--gri)">${IKON.mesaj}</span><h3>Destek</h3><p>Takıldığın yerde Telegram üzerinden yazabilirsin.</p></div>
</div>
</section>

<section class="bolum">
<h2>Nasıl çalışır?</h2>
<div class="adimlar">
<div><h3>Üye ol</h3><p>Kullanıcı adı ve şifreyle hesabını aç.</p></div>
${acikKayit ? `<div><h3>Adresini kopyala</h3><p>EPG adresin kayıttan hemen sonra panelinde.</p></div>` : `<div><h3>Paketini seç</h3><p>Panelinden paketini seç ve ödeme bilgilerini gör.</p></div>
<div><h3>Onay</h3><p>Ödeme kontrol edilince üyeliğin açılır.</p></div>`}
<div><h3>Adresi ekle</h3><p>Panelindeki EPG adresini IPTV uygulamana gir.</p></div>
</div>
</section>

<section class="bolum">
<h2>Uyumlu uygulamalar</h2>
<p class="alt">XMLTV biçiminde EPG adresi kabul eden uygulamalarla çalışır. Aşağıdakiler için adım adım anlatım var.</p>
<div class="etiketler"><span>TiviMate</span><span>OTT Navigator</span><span>IPTV Smarters Pro</span><span>Televizo</span><span>Smart IPTV</span></div>
</section>

<section class="cagri"><h2>Hazır mısın?</h2><p>${acikKayit ? "Üye ol, EPG adresin hemen panelinde." : "Üye ol, onaydan sonra EPG adresin panelinde seni bekliyor olacak."}</p><a href="/kayit">Üye ol</a></section>
</main>
${ALT}`));
}

// Uygulama başına kurulum adımları. dogrulandi: bu adımları kendimiz denedik ya da uygulamanın resmi belgesinde yazıyor.
const UYGULAMALAR = [
  {
    ad: "TiviMate", rozet: "Denendi", dogrulandi: true,
    not: "EPG Deposu adresi TiviMate'te denendi ve çalışıyor. Menü adları uygulama sürümüne göre küçük farklılıklar gösterebilir.",
    adimlar: [
      "<b>Ayarlar → EPG → EPG kaynakları</b>'na gir ve yeni kaynak ekle.",
      "Panelindeki EPG adresini yapıştır ve kaydet.",
      "<b>Ayarlar → Oynatma listeleri</b>'nde listeni seç; <b>EPG kaynakları</b> bölümünde yeni kaynağın seçili olduğundan emin ol.",
      "Kaynağın yanında ünlem (!) görürsen adresi kontrol et. Birkaç dakika sonra yayın akışı kanallarda görünür.",
    ],
  },
  {
    ad: "OTT Navigator", rozet: "Resmi kaynak", dogrulandi: true,
    not: "Menü yolu OTT Navigator'ın resmi SSS sayfasından alındı. Bu yolla eklenen EPG'de kanallar ada göre eşleştirilir.",
    kaynak: "https://github.com/ottnav/ottnav.github.io/blob/main/faq.md",
    adimlar: [
      "<b>Ayarlar → EPG → Kullanıcı tanımlı</b> (İngilizce menüde <i>Settings → EPG → User-provided</i>) bölümüne gir.",
      "Panelindeki EPG adresini ekle.",
      "<b>Ayarlar → EPG → Yeniden yükle</b> (<i>Reload</i>) ile EPG'yi yükle ve sonucu kontrol et.",
    ],
  },
  {
    ad: "IPTV Smarters Pro", dogrulandi: false,
    not: "Bu adımlar bir IPTV sağlayıcısının rehberinden alındı, uygulamanın kendi belgesinden doğrulanamadı. Xtream Codes ile girişte uygulama EPG'yi sağlayıcından alır; harici EPG adresi M3U ile girişte kullanılır.",
    kaynak: "https://portal.geniptv.org/knowledgebase.php?action=displayarticle&id=95",
    adimlar: [
      "<b>Add user</b> → <b>Login with Playlist</b> ile M3U adresinle giriş yap.",
      "<b>Install EPG</b>'ye bas.",
      "Panelindeki EPG adresini gir ve kaydet.",
    ],
  },
  {
    ad: "Smart IPTV", dogrulandi: false,
    not: "Smart IPTV'nin resmi liste yükleme sayfasında bir EPG alanı var; ancak sayfa harici XMLTV adreslerini açıkça desteklediğini yazmıyor.",
    kaynak: "https://siptv.app/mylist/",
    adimlar: [
      "Bilgisayarından ya da telefonundan Smart IPTV'nin <b>siptv.app/mylist</b> sayfasını aç.",
      "Cihazının MAC adresini girerek oynatma listeni yükle.",
      "<b>EPG</b> alanına panelindeki EPG adresini ekle ve gönder.",
      "Uygulamayı yeniden başlat.",
    ],
  },
  {
    ad: "Televizo", dogrulandi: false,
    not: "Televizo için güvenilir bir adım adım kaynak bulamadık. Genel olarak EPG kaynağı uygulamanın ayarlarından eklenir; menü adları sürüme göre değişebilir.",
    adimlar: [
      "Uygulamanın <b>Ayarlar</b> menüsünü aç.",
      "EPG ya da TV rehberi kaynağı ekleme seçeneğini bul.",
      "Panelindeki EPG adresini gir ve kaydet.",
    ],
  },
];

export function kurulumSayfasi() {
  const bolumler = UYGULAMALAR.map((u, i) => `<details class="uyg"${i === 0 ? " open" : ""}>
<summary><span>${u.ad}</span></summary>
<div><ol>${u.adimlar.map((a) => `<li>${a}</li>`).join("")}</ol>
<p class="kaynak">${u.not}${u.kaynak ? ` Kaynak: <a href="${u.kaynak}" target="_blank" rel="noopener">${u.kaynak.replace(/^https:\/\//, "")}</a>` : ""}</p></div>
</details>`).join("\n");

  return html(uyeSablon("Kurulum rehberi", `${STIL}${UST("kurulum")}
<main class="rehber">
<h1>Kurulum rehberi</h1>
<p>EPG adresin panelinde, <b>“EPG adresin”</b> kartında yazıyor. Aşağıdan kullandığın uygulamayı seç.</p>
<section class="kutu" style="margin-top:16px">
<h2 style="font-size:16px">Başlamadan önce</h2>
<ul style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px;color:var(--soluk);font-size:15px">
<li>Adresin <code>.xml.gz</code> ile biter (sıkıştırılmış, hızlı iner). Uygulaman sıkıştırılmış dosyayı açamazsa adresin sonundaki <code>.gz</code>'yi silerek <code>.xml</code> halini kullan.</li>
<li>Yayın akışı, oynatma listendeki kanal adlarıyla eşleşir. Bir kanalda akış görünmezse uygulamanın kanal ayarlarından EPG kanalını elle seçebilirsin.</li>
<li>Adresini kimseyle paylaşma. Paylaştıysan panelinden <b>Token yenile</b> ile yenisini al.</li>
</ul></section>
${bolumler}
<section class="kutu" style="margin-top:16px">
<h2 style="font-size:16px">Takıldın mı?</h2>
<p>Panelindeki <b>Destek</b> kartından Telegram üzerinden yazabilirsin.</p>
<a class="dugme ikincil" href="/panel" style="text-decoration:none">Panele git</a>
</section>
</main>
${ALT}`));
}
