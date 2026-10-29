# Her kanal için birden fazla kaynaktan gelen EPG'yi birleştirir:
# kanal başına en çok program veren kaynak seçilir (eşitlikte öncelik sırası).
import os, re, sys, glob, collections
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

ONCELIK = ['tvplus.com.tr', 'digiturk.com.tr', 'dsmart.com.tr', 'turksatkablo.com.tr', 'ipko.tv', 'tivibu.com.tr', 'tvprofil.com']
YABANCI = {'ipko.tv', 'tvprofil.com'}   # program adları İngilizce gelebilir

kanallar = ET.parse('channels.xml').getroot().findall('channel')
sira, ad = [], {}
for c in kanallar:
    x = c.get('xmltv_id')
    if x not in ad:
        sira.append(x); ad[x] = c.text

# guides/<site>.xml dosyalarını oku
veri = {}   # site -> {'channels': {id: elem}, 'programs': {id: [elem]}}
for yol in glob.glob('guides/*.xml'):
    site = os.path.basename(yol)[:-4]
    try:
        kok = ET.parse(yol).getroot()
    except ET.ParseError as e:
        print(f'{yol} okunamadi: {e}'); continue
    d = {'channels': {}, 'programs': collections.defaultdict(list)}
    for c in kok.findall('channel'):
        d['channels'][c.get('id')] = c
    for p in kok.findall('programme'):
        d['programs'][p.get('channel')].append(p)
    veri[site] = d

# KV'deki mevcut EPG'yi "onceki" veri olarak al (kaynak geçici düşerse kullanılır)
onceki_durum = 'okunamadi'

def onceki_veri():
    global onceki_durum
    yol = os.environ.get('ONCEKI_TEST')          # yerel test için
    try:
        if yol:
            ham = open(yol, 'rb').read()
        else:   # Cloudflare KV'den doğrudan (REST API)
            import urllib.request
            url = ('https://api.cloudflare.com/client/v4/accounts/{}/storage/kv/namespaces/{}/values/guide.xml'
                   .format(os.environ['CLOUDFLARE_ACCOUNT_ID'], os.environ['CF_KV_ID']))
            req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + os.environ['CLOUDFLARE_API_TOKEN']})
            with urllib.request.urlopen(req, timeout=120) as r:
                ham = r.read()
        bas = ham.find(b'<?xml')
        if bas < 0: bas = ham.find(b'<tv')
        son = ham.rfind(b'</tv>')
        kok = ET.fromstring(ham[bas:son + 5])
    except Exception as e:
        onceki_durum = f'okunamadi ({str(e)[:100]})'
        print(f'Onceki EPG alinamadi: {e}'); return None
    simdi = datetime.now(timezone.utc)
    d = {'channels': {}, 'programs': collections.defaultdict(list)}
    for c in kok.findall('channel'):
        d['channels'][c.get('id')] = c
    for p in kok.findall('programme'):
        try:
            if datetime.strptime(p.get('stop'), '%Y%m%d%H%M%S %z') > simdi:
                d['programs'][p.get('channel')].append(p)
        except (TypeError, ValueError):
            pass
    onceki_durum = f'{sum(len(v) for v in d["programs"].values())} gelecek program okundu'
    return d

onceki = onceki_veri()

secim, bos, korunan = {}, [], []
for x in sira:
    # Türk kaynaklarından veri varsa her zaman onlar seçilir; ipko/tvprofil yalnızca başka kaynak yoksa
    adaylar = [(0 if s in YABANCI else 1, len(veri[s]['programs'].get(x, [])),
                -ONCELIK.index(s) if s in ONCELIK else -99, s) for s in veri]
    adaylar = [a for a in adaylar if a[1] > 0]
    if adaylar:
        secim[x] = max(adaylar)[3]
    elif onceki and onceki['programs'].get(x):
        secim[x] = 'onceki'; korunan.append(ad[x])
    else:
        bos.append(ad[x])
if onceki:
    veri['onceki'] = onceki

# Açıklaması olmayan ya da kısa olan programlara, aynı kanalda aynı programın başka kaynaktaki
# daha uzun açıklamasını koy (başlangıç en fazla 5 dk farklı ve program adı aynı/biri diğerini içeriyorsa)
def _ad(t):
    return re.sub(r'[^a-z0-9]', '', (t or '').lower().translate(str.maketrans('ıİçğöşüâî', 'iicgosuai')))

def _zaman(s):
    try:
        return datetime.strptime(s, '%Y%m%d%H%M%S %z')
    except (TypeError, ValueError):
        return None

UZUNLUK_FARKI = 20   # mevcut açıklamadan en az bu kadar karakter uzunsa değiştir
aciklama_eklenen = aciklama_uzatilan = 0
for x, s in secim.items():
    havuz = collections.defaultdict(list)   # dakika -> [(ad, açıklama)] — diğer kaynaklardan
    for diger in veri:
        if diger == s:
            continue
        for p in veri[diger]['programs'].get(x, []):
            ac = (p.findtext('desc') or '').strip()
            bas = _zaman(p.get('start'))
            if ac and bas:
                havuz[int(bas.timestamp()) // 60].append((_ad(p.findtext('title')), ac))
    if not havuz:
        continue
    for p in veri[s]['programs'][x]:
        bas, ad_ = _zaman(p.get('start')), _ad(p.findtext('title'))
        if not bas or not ad_:
            continue
        dk = int(bas.timestamp()) // 60
        uygun = [ac for d in range(dk - 5, dk + 6) for had, ac in havuz.get(d, [])
                 if had and (had == ad_ or had in ad_ or ad_ in had)]
        if not uygun:
            continue
        en_uzun = max(uygun, key=len)
        mevcut = p.find('desc')
        simdiki = (mevcut.text or '').strip() if mevcut is not None else ''
        if not simdiki:
            if mevcut is None:
                mevcut = ET.Element('desc', {'lang': 'tr'})
                baslik = p.find('title')
                p.insert(list(p).index(baslik) + 1 if baslik is not None else 0, mevcut)
            mevcut.text = en_uzun
            aciklama_eklenen += 1
        elif len(en_uzun) >= len(simdiki) + UZUNLUK_FARKI:
            mevcut.text = en_uzun
            aciklama_uzatilan += 1

# IPTV listelerindeki farklı adlarla da eşleşsin diye ek adlar (ek_adlar.tsv: xmltv_id<TAB>ad)
ek_adlar = collections.defaultdict(list)
if os.path.exists('ek_adlar.tsv'):
    for satir in open('ek_adlar.tsv', encoding='utf-8'):
        if '\t' in satir:
            x_, a_ = satir.rstrip('\n').split('\t', 1)
            ek_adlar[x_].append(a_.strip())

cikti = ET.Element('tv', {'generator-info-name': 'epgdeposu'})
sadece_logo = []
for x in sira:
    if x not in secim:
        # Yayın akışı yok ama logosu varsa kanalı programsız ekle (uygulamada en azından ad ve logo görünür)
        if not os.path.exists(f'logos/{x}.png'): continue
        secim_yok = True; sadece_logo.append(ad[x])
        c = None
    else:
        secim_yok = False
        c = veri[secim[x]]['channels'].get(x)
    if c is None:
        c = ET.Element('channel', {'id': x})
        ET.SubElement(c, 'display-name', {'lang': 'tr'}).text = ad[x]
    var_olan = {(d.text or '').strip().lower() for d in c.findall('display-name')}
    for a_ in ek_adlar.get(x, []):
        if a_.lower() not in var_olan:
            yeni_ad = ET.Element('display-name', {'lang': 'tr'}); yeni_ad.text = a_
            c.insert(len(c.findall('display-name')), yeni_ad); var_olan.add(a_.lower())
    if os.path.exists(f'logos/{x}.png'):   # depodaki logo varsa her zaman onu kullan
        for i in c.findall('icon'):
            c.remove(i)
        ET.SubElement(c, 'icon', {'src': f'https://epg.epgdeposu.workers.dev/logo/{x}.png'})
    if c.find('icon') is None and not secim_yok:   # logo başka kaynağın kaydında varsa onu kullan
        for s in veri:
            diger = veri[s]['channels'].get(x)
            if diger is not None and diger.find('icon') is not None:
                c.append(diger.find('icon')); break
    cikti.append(c)
toplam = 0
for x in sira:
    if x not in secim: continue
    for p in veri[secim[x]]['programs'][x]:
        cikti.append(p); toplam += 1
ET.ElementTree(cikti).write('guide.xml', encoding='utf-8', xml_declaration=True)
boyut = os.path.getsize('guide.xml')
import gzip
with open('guide.xml', 'rb') as f, open('guide.xml.gz', 'wb') as g:
    g.write(gzip.compress(f.read(), compresslevel=9, mtime=0))
gz_boyut = os.path.getsize('guide.xml.gz')

# Log'dan kaynak bazında hata özeti
istek = collections.Counter(); bos_istek = collections.Counter(); hata = collections.defaultdict(collections.Counter)
son_site = None
if os.path.exists('grab.log'):
    for satir in open('grab.log', encoding='utf-8', errors='replace'):
        m = re.search(r'\] (\S+) \(\w*\) - .* \((\d+) programs\)', satir)
        if m:
            son_site = m.group(1); istek[son_site] += 1
            if m.group(2) == '0': bos_istek[son_site] += 1
            continue
        m = re.search(r'ERR: (.*)', satir)
        if m and son_site:
            hata[son_site][m.group(1).strip()[:120]] += 1

kaynak_sayi = collections.Counter(secim.values())
rapor = [
    '## EPG raporu',
    f'- Dosya boyutu: {boyut/1024/1024:.1f} MB (gzip: {gz_boyut/1024/1024:.1f} MB)',
    f'- Toplam program: {toplam}',
    f'- Verisi gelen kanal: {len(secim)} / {len(sira)}',
    f'- Onceki EPG: {onceki_durum}',
    f'- Baska kaynaktan eklenen aciklama: {aciklama_eklenen}',
    f'- Daha uzun aciklamayla degistirilen: {aciklama_uzatilan}',
    '',
    '### Kaynak durumu',
]
for s in ONCELIK:
    if istek[s] or s in veri:
        rapor.append(f'- {s}: {istek[s]} istek, {bos_istek[s]} bos, {kaynak_sayi[s]} kanalda secildi')
        for msg, n in hata[s].most_common(3):
            rapor.append(f'  - Hata ({n}x): {msg}')
rapor += ['', f'### Onceki veriden korunan kanallar ({len(korunan)})'] + ([f'- {k}' for k in korunan] or ['- Yok'])
rapor += ['', '### Verisi gelmeyen kanallar'] + ([f'- {b}' for b in bos] or ['- Yok'])
rapor += ['', f'### Yalnizca ad ve logoyla eklenen kanallar ({len(sadece_logo)})'] + ([f'- {b}' for b in sadece_logo] or ['- Yok'])

metin = '\n'.join(rapor) + '\n'
print(metin)
if os.environ.get('GITHUB_STEP_SUMMARY'):
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as f:
        f.write(metin)

if toplam == 0:
    sys.exit('Hic program gelmedi, KV guncellenmeyecek.')
if boyut > 24 * 1024 * 1024:
    sys.exit("Dosya 24 MB'den buyuk, KV siniri asilabilir.")
