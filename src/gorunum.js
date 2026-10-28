// Üyelik sitesinin görünümü (EPG Deposu): şablon, stil, logo, ortak parçalar
import { kac } from "./ortak.js";

const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

// "2027-04-27" -> "27 Nisan 2027";  "2026-10-28 02:51" -> "28 Ekim 2026, 02:51"
export function tarihYaz(s) {
  if (!s) return "";
  const [t, saat] = String(s).split(" ");
  const [y, a, g] = t.split("-").map(Number);
  if (!y || !a || !g) return kac(s);
  return `${g} ${AYLAR[a - 1]} ${y}${saat ? ", " + saat : ""}`;
}

const STIL = `
:root{
  --zemin:#F4F6FB;--kart:#FFFFFF;--cizgi:#E3E8F1;--girdi:#D6DCE8;--yazi:#0F172A;--soluk:#475569;--soluk2:#64748B;
  --vurgu:#2563EB;--vurgu-koyu:#1D4ED8;--vurgu-yazi:#1D4ED8;--vurgu-acik:#E6EEFF;--halka:#2563EB;
  --turuncu-acik:#FFF1E6;--turuncu:#C2410C;--gri-acik:#EEF2F7;--gri:#334155;
  --iyi-z:#DCFCE7;--iyi-y:#166534;--bekle-z:#FEF3C7;--bekle-y:#92400E;--kotu-z:#FEE2E2;--kotu-y:#991B1B;
  color-scheme:light dark;
}
@media (prefers-color-scheme:dark){:root{
  --zemin:#0B1220;--kart:#121A2B;--cizgi:#1F2A40;--girdi:#2A3650;--yazi:#E6EAF2;--soluk:#A3AEC2;--soluk2:#8B97AD;
  --vurgu:#2563EB;--vurgu-koyu:#1D4ED8;--vurgu-yazi:#7DB2FF;--vurgu-acik:#1B2A4A;--halka:#60A5FA;
  --turuncu-acik:#3A2410;--turuncu:#FDBA74;--gri-acik:#1C2538;--gri:#CBD5E1;
  --iyi-z:#12351F;--iyi-y:#86EFAC;--bekle-z:#3A2A0A;--bekle-y:#FCD34D;--kotu-z:#3B1212;--kotu-y:#FCA5A5;
}}
*{box-sizing:border-box}
html,body{margin:0;background:var(--zemin);color:var(--yazi)}
body{font:16px/1.5 'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased}
a{color:var(--vurgu-yazi);text-decoration:none;font-weight:700}a:hover{text-decoration:underline}
h1,h2{margin:0;letter-spacing:-.02em}
.kap{max-width:440px;margin:0 auto;padding:48px 20px 32px;min-height:100vh;display:flex;flex-direction:column}
.marka{display:flex;align-items:center;gap:12px;font-size:20px;font-weight:800;letter-spacing:-.02em;color:var(--yazi)}
.marka:hover{text-decoration:none}
.logo{width:44px;height:44px;border-radius:12px;background:var(--vurgu);display:flex;align-items:center;justify-content:center;flex:none}
.ust-satir{display:flex;align-items:center;justify-content:space-between;gap:12px}
.baslik{margin-top:48px}
.baslik h1{font-size:30px;line-height:1.15;font-weight:800;letter-spacing:-.03em}
.baslik p{margin:10px 0 0;font-size:15px;color:var(--soluk)}
form.alanlar{margin-top:28px;display:flex;flex-direction:column;gap:16px}
.alan{display:flex;flex-direction:column;gap:6px}
.alan-ust{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
label{font-size:14px;font-weight:600}
.ipucu{font-size:13px;color:var(--soluk2);line-height:1.4}
input{height:52px;padding:0 16px;border:1px solid var(--girdi);border-radius:14px;background:var(--kart);color:var(--yazi);font:inherit;font-size:16px;width:100%}
input:focus{outline:none;border:2px solid var(--vurgu);padding:0 15px}
.dugme{height:54px;border:0;border-radius:14px;background:var(--vurgu);color:#FFF;font:inherit;font-size:16px;font-weight:700;cursor:pointer;width:100%;display:flex;align-items:center;justify-content:center;gap:8px}
.dugme:hover{background:var(--vurgu-koyu)}
.dugme.ikincil{height:48px;background:var(--kart);color:var(--yazi);border:1px solid var(--girdi);font-size:15px}
.dugme.ikincil:hover{background:var(--zemin)}
.alt-kart{margin-top:24px;padding:16px;border-radius:14px;background:var(--kart);border:1px solid var(--cizgi);display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:14px;color:var(--soluk)}
.dip{margin-top:auto;padding-top:32px;text-align:center;font-size:13px;color:var(--soluk2)}
.uyari{margin-top:20px;padding:12px 14px;border-radius:14px;font-size:14px;font-weight:600;line-height:1.45}
.uyari.bilgi{background:var(--vurgu-acik);color:var(--vurgu-yazi)}
.uyari.iyi{background:var(--iyi-z);color:var(--iyi-y)}
.uyari.hata{background:var(--kotu-z);color:var(--kotu-y)}
.guc{display:flex;gap:6px;margin-top:2px}.guc i{flex:1;height:4px;border-radius:4px;background:var(--girdi)}
.guc i.dolu{background:var(--vurgu)}
/* panel */
.ust-bar{background:var(--kart);border-bottom:1px solid var(--cizgi)}
.ust-bar>div{max-width:640px;margin:0 auto;height:64px;padding:0 20px;display:flex;align-items:center;justify-content:space-between}
.ust-bar .marka{font-size:17px;gap:10px}.ust-bar .logo{width:36px;height:36px;border-radius:10px}
.sag{display:flex;align-items:center;gap:8px}
.avatar{width:36px;height:36px;border-radius:18px;background:var(--vurgu-acik);color:var(--vurgu-yazi);font-weight:700;font-size:15px;display:flex;align-items:center;justify-content:center;text-transform:uppercase}
.ikon-dugme{width:44px;height:44px;border:0;border-radius:12px;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--soluk)}
.ikon-dugme:hover{background:var(--zemin)}
main.icerik{max-width:640px;margin:0 auto;padding:24px 20px 40px;display:flex;flex-direction:column;gap:16px}
.selam{font-size:14px;color:var(--soluk)}.selam h1{margin-top:2px;font-size:26px;font-weight:800;letter-spacing:-.03em;color:var(--yazi)}
.kutu{background:var(--kart);border:1px solid var(--cizgi);border-radius:20px;padding:20px;display:flex;flex-direction:column;gap:12px}
.kutu p{margin:0;font-size:14px;color:var(--soluk)}
.kutu-bas{display:flex;align-items:center;gap:10px}.kutu-bas h2{font-size:17px;font-weight:700}
.kutu-ikon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none}
.durum-kutu{flex-direction:row;align-items:center;gap:20px}
.durum-bilgi{display:flex;flex-direction:column;gap:4px;min-width:0}
.rozet{align-self:flex-start;padding:4px 10px;border-radius:99px;font-size:13px;font-weight:700;margin-bottom:4px}
.rozet.aktif{background:var(--iyi-z);color:var(--iyi-y)}
.rozet.bekliyor,.rozet.durduruldu{background:var(--bekle-z);color:var(--bekle-y)}
.rozet.doldu,.rozet.kapali{background:var(--kotu-z);color:var(--kotu-y)}
.etiket{font-size:13px;color:var(--soluk)}.deger{font-size:17px;font-weight:700}
.adres{padding:14px;border-radius:14px;background:var(--zemin);border:1px solid var(--cizgi);font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;line-height:1.5;word-break:break-all;color:var(--yazi)}
.bekle-orta{align-items:center;text-align:center;padding:28px 20px}
.bekle-orta h2{font-size:20px;font-weight:800}
.bekle-ikon{width:72px;height:72px;border-radius:36px;background:var(--bekle-z);display:flex;align-items:center;justify-content:center;color:var(--bekle-y)}
.adim{display:flex;gap:12px;align-items:flex-start;font-size:14px}
.adim-no{width:28px;height:28px;flex:none;border-radius:14px;border:2px solid var(--girdi);color:var(--soluk);font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center}
.adim-no.bitti{background:var(--vurgu);border-color:var(--vurgu);color:#FFF}
.adim-no.simdi{border-color:var(--vurgu);color:var(--vurgu-yazi)}
.adim span{color:var(--soluk)}
`;

const KOPYALA_JS = `<script>
function kopyala(b){var a=b.getAttribute('data-adres');var bitti=function(){var e=b.querySelector('span');e.textContent='Kopyalandı';setTimeout(function(){e.textContent='Adresi kopyala'},1600)};
if(navigator.clipboard){navigator.clipboard.writeText(a).then(bitti,function(){eski(a);bitti()})}else{eski(a);bitti()}}
function eski(a){var t=document.createElement('textarea');t.value=a;document.body.appendChild(t);t.select();try{document.execCommand('copy')}catch(e){}document.body.removeChild(t)}
function guc(i){var v=i.value,p=0;if(v.length>=8)p++;if(v.length>=12)p++;if(/[0-9]/.test(v)&&/[a-zA-Z]/.test(v)&&v.length>=10)p++;var c=document.querySelectorAll('.guc i');for(var k=0;k<c.length;k++)c[k].className=k<p?'dolu':''}
</script>`;

export function uyeSablon(baslik, govde) {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${kac(baslik)} · EPG Deposu</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap">
<style>${STIL}</style></head><body>
${govde}
${KOPYALA_JS}
</body></html>`;
}

// ---------- İkonlar (çizgi SVG) ----------
const svg = (yol, boyut = 20, renk = "currentColor") =>
  `<svg width="${boyut}" height="${boyut}" viewBox="0 0 24 24" fill="none" stroke="${renk}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${yol}</svg>`;
export const IKON = {
  logo: (b) => svg('<rect x="3" y="5" width="18" height="12" rx="2"></rect><path d="M8 21h8"></path><path d="M7 9h6"></path><path d="M7 13h10"></path>', b, "#FFFFFF"),
  cikis: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="M16 17l5-5-5-5"></path><path d="M21 12H9"></path>'),
  link: svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>', 18),
  kopya: svg('<rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>', 18),
  yenile: svg('<path d="M21 12a9 9 0 1 1-2.64-6.36"></path><path d="M21 3v6h-6"></path>', 18),
  kilit: svg('<rect x="4" y="11" width="16" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path>', 18),
  saat: svg('<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>', 34),
  tamam: svg('<path d="M5 12l5 5L20 7"></path>', 14),
};

export function marka(boyut = 24) {
  return `<a class="marka" href="/giris"><span class="logo">${IKON.logo(boyut)}</span>EPG Deposu</a>`;
}

export function uyari(mesaj, tur = "bilgi") {
  return mesaj ? `<div class="uyari ${tur}" role="${tur === "hata" ? "alert" : "status"}">${kac(mesaj)}</div>` : "";
}

// Kalan gün halkası: oran 0..1
export function halka(kalan, oran) {
  const c = 314.16;
  const ofset = (c * (1 - Math.max(0, Math.min(1, oran)))).toFixed(1);
  return `<svg width="116" height="116" viewBox="0 0 116 116" role="img" aria-label="Üyeliğin bitmesine ${kalan} gün kaldı" style="flex:none">
<circle cx="58" cy="58" r="50" fill="none" stroke="var(--vurgu-acik)" stroke-width="10"></circle>
<circle cx="58" cy="58" r="50" fill="none" stroke="var(--halka)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${ofset}" transform="rotate(-90 58 58)"></circle>
<text x="58" y="56" text-anchor="middle" font-size="28" font-weight="800" fill="var(--yazi)" font-family="Plus Jakarta Sans, system-ui, sans-serif">${kalan}</text>
<text x="58" y="76" text-anchor="middle" font-size="12" font-weight="600" fill="var(--soluk)" font-family="Plus Jakarta Sans, system-ui, sans-serif">gün kaldı</text>
</svg>`;
}
