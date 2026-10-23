# Digiturk EPG: Android box'ın KV'ye yüklediği günlük sayfaları (digiturk-YYYY-MM-DD) okur,
# channels.xml'deki digiturk.com.tr kanallarının programlarını guides/digiturk.com.tr.xml'e yazar.
import os, re, gzip, html, json, urllib.request, urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo('Europe/Istanbul')
TEST_DIR = os.environ.get('DIGITURK_TEST_DIR')   # yerel test için: klasörde digiturk-YYYY-MM-DD dosyaları

kanallar = [c for c in ET.parse('channels.xml').getroot().findall('channel')
            if c.get('site') == 'digiturk.com.tr']
site_id_to_xid = {c.get('site_id'): c.get('xmltv_id') for c in kanallar}

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

def coz(veri, gun):
    """Bir günün Digiturk sayfasından (site_id, başlangıç, bitiş, başlık, açıklama) listesi."""
    if veri[:2] == b'\x1f\x8b':
        veri = gzip.decompress(veri)
    metin = veri.decode('utf-8', errors='replace')
    kanal_prog = {}
    for p in metin.split('tvGuideResult-box-wholeDates channelDetail')[1:]:
        p = p[:4000]
        sa = re.search(r'wholeDates-time-hour">\s*(\d{1,2}):(\d{2})', p)
        dk = re.search(r'totalMinute">[^<\d]*(\d+)', p)
        oc = re.search(r"getDetail\('[^']*',\s*(\d+)\)", p)
        tt = re.search(r'wholeDates-title"[^>]*title="([^"]*)"', p)
        if not (sa and dk and oc and tt):
            continue
        ac = re.search(r'wholeDates-description"[^>]*title="([^"]*)"', p)
        kanal_prog.setdefault(oc.group(1), []).append(
            (int(sa.group(1)), int(sa.group(2)), int(dk.group(1)),
             html.unescape(tt.group(1)).strip(), html.unescape(ac.group(1)).strip() if ac else ''))
    sonuc = []
    for sid, liste in kanal_prog.items():
        g, onceki = gun, None
        for h, m, sure, baslik, aciklama in liste:      # sayfadaki sırayla; saat geri giderse ertesi gün
            bas = datetime(g.year, g.month, g.day, h, m, tzinfo=TZ)
            if onceki and bas < onceki:
                g += timedelta(days=1)
                bas += timedelta(days=1)
            onceki = bas
            sonuc.append((sid, bas, bas + timedelta(minutes=max(sure, 1)), baslik, aciklama))
    return sonuc

def kanal_listesi(veri):
    """Sayfadaki kanallar: {site_id: kanal adı}"""
    if veri[:2] == b'\x1f\x8b':
        veri = gzip.decompress(veri)
    metin = veri.decode('utf-8', errors='replace')
    kanallar_sayfa = {}
    for blok in metin.split('channelContent')[1:]:
        ad = re.search(r'id="channelID"[^>]*value="([^"]*)"', blok[:1500])
        sid = re.search(r"getDetail\('[^']*',\s*(\d+)\)", blok)
        if ad and sid:
            kanallar_sayfa.setdefault(sid.group(1), html.unescape(ad.group(1)).strip())
    return kanallar_sayfa

bugun = datetime.now(TZ).date()
programlar = {}   # xmltv_id -> {başlangıç: (bitiş, başlık, açıklama)}
sayfa_kanallari = {}
for g in range(-1, 7):
    gun = bugun + timedelta(days=g)
    anahtar = f'digiturk-{gun:%Y-%m-%d}'
    try:
        veri = oku(anahtar)
    except Exception as e:
        print(f'{anahtar}: okunamadi ({e})'); continue
    if not veri:
        print(f'{anahtar}: yok'); continue
    if not sayfa_kanallari:
        sayfa_kanallari = kanal_listesi(veri)
    say = 0
    for sid, bas, bit, baslik, aciklama in coz(veri, gun):
        xid = site_id_to_xid.get(sid)
        if not xid or not baslik:
            continue
        programlar.setdefault(xid, {})[bas] = (bit, baslik, aciklama)
        say += 1
    print(f'{anahtar}: {say} program (listedeki kanallar icin)')

tv = ET.Element('tv')
for c in kanallar:
    if c.get('xmltv_id') in programlar:
        ch = ET.SubElement(tv, 'channel', {'id': c.get('xmltv_id')})
        ET.SubElement(ch, 'display-name', {'lang': 'tr'}).text = c.text
toplam = 0
for xid, sozluk in programlar.items():
    basl = sorted(sozluk)
    for i, bas in enumerate(basl):
        bit, baslik, aciklama = sozluk[bas]
        if i + 1 < len(basl) and basl[i + 1] < bit:     # çakışmada bitişi kısalt
            bit = basl[i + 1]
        el = ET.SubElement(tv, 'programme', {
            'start': bas.strftime('%Y%m%d%H%M%S %z'),
            'stop': bit.strftime('%Y%m%d%H%M%S %z'),
            'channel': xid})
        ET.SubElement(el, 'title', {'lang': 'tr'}).text = baslik
        if aciklama and aciklama != baslik:
            ET.SubElement(el, 'desc', {'lang': 'tr'}).text = aciklama
        toplam += 1

os.makedirs('guides', exist_ok=True)
ET.ElementTree(tv).write('guides/digiturk.com.tr.xml', encoding='utf-8', xml_declaration=True)
print(f'Digiturk toplam: {toplam} program, {len(programlar)} / {len(kanallar)} kanal')
eksik = [c.text for c in kanallar if c.get('xmltv_id') not in programlar]
if eksik:
    print('Verisi olmayan Digiturk kanallari:', ', '.join(eksik))

# Digiturk sayfasında olup listemizde olmayan kanallar (yeni kanal eklemek için)
listede = set(site_id_to_xid)
yeni = sorted((ad, sid) for sid, ad in sayfa_kanallari.items() if sid not in listede)
print(f'\nDigiturk sayfasindaki kanal sayisi: {len(sayfa_kanallari)}, listemizde olmayan: {len(yeni)}')
for ad, sid in yeni:
    print(f'  {sid}: {ad}')
