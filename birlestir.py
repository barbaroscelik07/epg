# Her kanal için birden fazla kaynaktan gelen EPG'yi birleştirir:
# kanal başına en çok program veren kaynak seçilir (eşitlikte öncelik sırası).
import os, re, sys, glob, collections
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

ONCELIK = ['tvplus.com.tr', 'digiturk.com.tr', 'dsmart.com.tr', 'turksatkablo.com.tr', 'ipko.tv', 'tvprofil.com']

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
def onceki_veri():
    yol = os.environ.get('ONCEKI_TEST')          # yerel test için
    try:
        if yol:
            ham = open(yol, 'rb').read()
        else:
            import subprocess
            r = subprocess.run(['npx', '--yes', 'wrangler@4', 'kv', 'key', 'get', 'guide.xml',
                                f'--namespace-id={os.environ["CF_KV_ID"]}', '--remote'],
                               capture_output=True, timeout=180)
            ham = r.stdout
        bas = ham.find(b'<?xml')
        if bas < 0: bas = ham.find(b'<tv')
        kok = ET.fromstring(ham[bas:])
    except Exception as e:
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
    return d

onceki = onceki_veri()

secim, bos, korunan = {}, [], []
for x in sira:
    adaylar = [(len(veri[s]['programs'].get(x, [])), -ONCELIK.index(s) if s in ONCELIK else -99, s) for s in veri]
    adaylar = [a for a in adaylar if a[0] > 0]
    if adaylar:
        secim[x] = max(adaylar)[2]
    elif onceki and onceki['programs'].get(x):
        secim[x] = 'onceki'; korunan.append(ad[x])
    else:
        bos.append(ad[x])
if onceki:
    veri['onceki'] = onceki

cikti = ET.Element('tv', {'generator-info-name': 'epgdeposu'})
for x in sira:
    if x not in secim: continue
    c = veri[secim[x]]['channels'].get(x)
    if c is None:
        c = ET.Element('channel', {'id': x})
        ET.SubElement(c, 'display-name', {'lang': 'tr'}).text = ad[x]
    if c.find('icon') is None:   # logo başka kaynağın kaydında varsa onu kullan
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
    f'- Dosya boyutu: {boyut/1024/1024:.1f} MB',
    f'- Toplam program: {toplam}',
    f'- Verisi gelen kanal: {len(secim)} / {len(sira)}',
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

metin = '\n'.join(rapor) + '\n'
print(metin)
if os.environ.get('GITHUB_STEP_SUMMARY'):
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as f:
        f.write(metin)

if toplam == 0:
    sys.exit('Hic program gelmedi, KV guncellenmeyecek.')
if boyut > 24 * 1024 * 1024:
    sys.exit("Dosya 24 MB'den buyuk, KV siniri asilabilir.")
