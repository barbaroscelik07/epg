# Yedek kaynak: yayinakisi.co EPG dosyası (adres GitHub secret YAYINAKISI_URL'de; izinli kullanım).
# Kanal adlarını bizim kanallarla eşleştirir ve guides/yayinakisi.co.xml'e yazar.
# birlestir.py bu kaynağı yalnızca bizim kaynaklarımızın hiç veri vermediği kanallarda kullanır.
import os, re, gzip, collections, urllib.request
import xml.etree.ElementTree as ET

URL = os.environ.get('YAYINAKISI_URL', '').strip()
TEST = os.environ.get('YAYINAKISI_TEST')   # yerel test: dosya yolu
if not URL and not TEST:
    print('YAYINAKISI_URL yok, yedek kaynak atlandi'); raise SystemExit(0)

def norm(s):
    s = (s or '').lower().replace('i̇', 'i').translate(str.maketrans('ıçğöşüâî', 'icgosuai'))
    s = re.sub(r'\b(hd|fhd|uhd|sd|4k)\b', ' ', s)
    return re.sub(r'[^a-z0-9]', '', s)

# Bizim adlar: channels.xml'deki adlar + ek_adlar.tsv + xmltv_id gövdesi
adaylar = collections.defaultdict(set)   # normalize ad -> {xmltv_id}
for c in ET.parse('channels.xml').getroot().findall('channel'):
    x = c.get('xmltv_id')
    adaylar[norm(c.text)].add(x)
    adaylar[norm(x.split('.')[0])].add(x)
if os.path.exists('ek_adlar.tsv'):
    for satir in open('ek_adlar.tsv', encoding='utf-8'):
        if '\t' in satir:
            x, a = satir.rstrip('\n').split('\t', 1)
            adaylar[norm(a)].add(x)
elle = {}   # ya_eslesme.tsv: yayinakisi kanal adı<TAB>xmltv_id (otomatik eşleşmeyenler için)
if os.path.exists('ya_eslesme.tsv'):
    for satir in open('ya_eslesme.tsv', encoding='utf-8'):
        if '\t' in satir:
            a, x = satir.rstrip('\n').split('\t', 1)
            elle[a.strip()] = x.strip()

if TEST:
    ham = open(TEST, 'rb').read()
else:
    req = urllib.request.Request(URL, headers={'user-agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=180) as r:
        ham = r.read()
if ham[:2] == b'\x1f\x8b':
    ham = gzip.decompress(ham)
kok = ET.fromstring(ham)

eslesme, eslesmeyen, belirsiz = {}, [], []
for c in kok.findall('channel'):
    cid = c.get('id')
    if cid in elle:
        eslesme[cid] = elle[cid]; continue
    xs = adaylar.get(norm(cid), set()) | set().union(*(adaylar.get(norm(d.text), set()) for d in c.findall('display-name')))
    if len(xs) == 1:
        eslesme[cid] = xs.pop()
    elif xs:
        belirsiz.append(cid)
    else:
        eslesmeyen.append(cid)

cikti = ET.Element('tv', {'generator-info-name': 'yayinakisi-yedek'})
kanal_eklendi, say = set(), collections.Counter()
programlar = []
for p in kok.findall('programme'):
    x = eslesme.get(p.get('channel'))
    if not x:
        continue
    p.set('channel', x); programlar.append(p); say[x] += 1
for c in kok.findall('channel'):
    x = eslesme.get(c.get('id'))
    if x and x not in kanal_eklendi and say[x]:
        c.set('id', x); kanal_eklendi.add(x); cikti.append(c)
for p in programlar:
    cikti.append(p)
os.makedirs('guides', exist_ok=True)
ET.ElementTree(cikti).write('guides/yayinakisi.co.xml', encoding='utf-8', xml_declaration=True)
ozet = (f'yayinakisi yedek: {len(kok.findall("channel"))} kanal, {len(eslesme)} eslesti '
        f'({len(kanal_eklendi)} tanesinde program var), {len(eslesmeyen)} eslesmedi, {len(belirsiz)} belirsiz')
print(ozet); print('::notice::' + ozet)
print('::notice::yayinakisi eslesmeyen kanallar: ' + ', '.join(eslesmeyen))
if belirsiz:
    print('::notice::yayinakisi belirsiz eslesme: ' + ', '.join(belirsiz[:60]))
