# Tivibu EPG: Android box'ın KV'ye yüklediği tivibu-YYYY-MM-DD kaydını okur (her satır: kanal_kodu<TAB>JSON,
# tivibu.com.tr/Channel/GetPrevueList yanıtı). channels.xml'deki tivibu.com.tr kanallarını guides/tivibu.com.tr.xml'e yazar.
import os, json, gzip, urllib.request, urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo('Europe/Istanbul')
TEST_DIR = os.environ.get('TIVIBU_TEST_DIR')

kanallar = [c for c in ET.parse('channels.xml').getroot().findall('channel')
            if c.get('site') == 'tivibu.com.tr']
kod_to_xid = {c.get('site_id'): c.get('xmltv_id') for c in kanallar}

def oku(anahtar):
    if TEST_DIR:
        yol = os.path.join(TEST_DIR, anahtar)
        return open(yol, 'rb').read() if os.path.exists(yol) else None
    url = ('https://api.cloudflare.com/client/v4/accounts/{}/storage/kv/namespaces/{}/values/{}'
           .format(os.environ['CLOUDFLARE_ACCOUNT_ID'], os.environ['CF_KV_ID'], anahtar))
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + os.environ['CLOUDFLARE_API_TOKEN']})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise

def liste_bul(o):
    """JSON içinde 'mobilPrevueViewModel' listesini bul."""
    if isinstance(o, dict):
        if isinstance(o.get('mobilPrevueViewModel'), list):
            return o['mobilPrevueViewModel']
        for v in o.values():
            r = liste_bul(v)
            if r is not None:
                return r
    elif isinstance(o, list):
        for v in o:
            r = liste_bul(v)
            if r is not None:
                return r
    return None

def zaman(s):
    return datetime.strptime(s[:16], '%Y.%m.%d %H:%M').replace(tzinfo=TZ)

def temiz(s):
    return (s or '').replace('!??!', '-').strip()

bugun = datetime.now(TZ).date()
veri, kullanilan = None, None
for g in range(0, 4):     # en yeni kayıt (box birkaç gün açılmasa da eski kayıt kullanılır)
    anahtar = f'tivibu-{bugun - timedelta(days=g):%Y-%m-%d}'
    try:
        veri = oku(anahtar)
    except Exception as e:
        print(f'{anahtar}: okunamadi ({e})'); veri = None
    if veri:
        kullanilan = anahtar; break
    print(f'{anahtar}: yok')

programlar = {}
if veri:
    if veri[:2] == b'\x1f\x8b':
        veri = gzip.decompress(veri)
    for satir in veri.decode('utf-8', errors='replace').splitlines():
        if '\t' not in satir:
            continue
        kod, js = satir.split('\t', 1)
        xid = kod_to_xid.get(kod.strip())
        if not xid:
            continue
        try:
            liste = liste_bul(json.loads(js)) or []
        except json.JSONDecodeError:
            continue
        for p in liste:
            try:
                bas, bit = zaman(p['beginTime']), zaman(p['endTime'])
            except (KeyError, ValueError, TypeError):
                continue
            baslik = temiz(p.get('prevueName'))
            if baslik and bit > bas:
                programlar.setdefault(xid, {})[bas] = (bit, baslik, temiz(p.get('description')),
                                                        temiz(p.get('genre')), (p.get('prevueImage') or '').strip())
    print(f'{kullanilan}: {sum(len(v) for v in programlar.values())} program')

tv = ET.Element('tv')
for c in kanallar:
    if c.get('xmltv_id') in programlar:
        ch = ET.SubElement(tv, 'channel', {'id': c.get('xmltv_id')})
        ET.SubElement(ch, 'display-name', {'lang': 'tr'}).text = c.text
toplam = 0
for xid, sozluk in programlar.items():
    basl = sorted(sozluk)
    for i, bas in enumerate(basl):
        bit, baslik, aciklama, tur, gorsel = sozluk[bas]
        if i + 1 < len(basl) and basl[i + 1] < bit:
            bit = basl[i + 1]
        el = ET.SubElement(tv, 'programme', {
            'start': bas.strftime('%Y%m%d%H%M%S %z'), 'stop': bit.strftime('%Y%m%d%H%M%S %z'), 'channel': xid})
        ET.SubElement(el, 'title', {'lang': 'tr'}).text = baslik
        if aciklama:
            ET.SubElement(el, 'desc', {'lang': 'tr'}).text = aciklama
        if tur:
            ET.SubElement(el, 'category', {'lang': 'tr'}).text = tur
        if gorsel.startswith('http'):
            ET.SubElement(el, 'icon', {'src': gorsel})
        toplam += 1

os.makedirs('guides', exist_ok=True)
ET.ElementTree(tv).write('guides/tivibu.com.tr.xml', encoding='utf-8', xml_declaration=True)
print(f'Tivibu toplam: {toplam} program, {len(programlar)} / {len(kanallar)} kanal')
eksik = [c.text for c in kanallar if c.get('xmltv_id') not in programlar]
if eksik:
    print('Verisi olmayan Tivibu kanallari:', ', '.join(eksik))
