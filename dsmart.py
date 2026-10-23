# D-Smart EPG: Android box'ın KV'ye yüklediği günlük API yanıtlarını (dsmart-YYYY-MM-DD,
# her satır bir sayfa JSON) okur; channels.xml'deki dsmart.com.tr kanallarını guides/dsmart.com.tr.xml'e yazar.
# Zaman hesabı iptv-org'un dsmart.com.tr.config.js mantığıyla aynıdır.
import os, json, gzip, urllib.request, urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

TZ = ZoneInfo('Europe/Istanbul')
TEST_DIR = os.environ.get('DSMART_TEST_DIR')

kanallar = [c for c in ET.parse('channels.xml').getroot().findall('channel')
            if c.get('site') == 'dsmart.com.tr']
id_to_xid = {c.get('site_id'): c.get('xmltv_id') for c in kanallar}

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

def utc(s):
    return datetime.strptime(s[:19], '%Y-%m-%dT%H:%M:%S').replace(tzinfo=timezone.utc)

def sure_sn(s):
    if ',' in s:
        s = s.split(',')[1].strip()        # "1 day, 2:00:00" -> gün kısmı yok sayılır (iptv-org ile aynı)
    h, m, sn = (int(x) for x in s.split(':'))
    return h * 3600 + m * 60 + sn

def coz_kanal(schedule):
    sonuc, gun_bas, ofs = [], None, None
    for p in schedule:
        try:
            temel = utc(p['day'])
            bas_ham = utc(p['start_date'])
            if gun_bas is None:
                gun_bas = bas_ham
                ofs = (utc(p['day'][:11] + p['start_date'][11:]) - temel).total_seconds()
            delta = (bas_ham - gun_bas).total_seconds()
            bas = temel + timedelta(seconds=ofs + delta)
            bit = bas + timedelta(seconds=sure_sn(p['duration']))
        except (KeyError, ValueError, TypeError):
            continue
        baslik = (p.get('program_name') or '').strip()
        if baslik:
            sonuc.append((bas, bit, baslik, (p.get('description') or '').strip()))
    return sonuc

bugun = datetime.now(TZ).date()
programlar = {}
for g in range(-1, 7):
    gun = bugun + timedelta(days=g)
    anahtar = f'dsmart-{gun:%Y-%m-%d}'
    try:
        veri = oku(anahtar)
    except Exception as e:
        print(f'{anahtar}: okunamadi ({e})'); continue
    if not veri:
        print(f'{anahtar}: yok'); continue
    if veri[:2] == b'\x1f\x8b':
        veri = gzip.decompress(veri)
    say = 0
    for satir in veri.decode('utf-8', errors='replace').splitlines():
        satir = satir.strip()
        if not satir:
            continue
        try:
            sayfa = json.loads(satir)
        except json.JSONDecodeError:
            continue
        for k in (sayfa.get('data') or {}).get('channels') or []:
            xid = id_to_xid.get(k.get('_id'))
            if not xid:
                continue
            for bas, bit, baslik, aciklama in coz_kanal(k.get('schedule') or []):
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
        if i + 1 < len(basl) and basl[i + 1] < bit:
            bit = basl[i + 1]
        el = ET.SubElement(tv, 'programme', {
            'start': bas.astimezone(TZ).strftime('%Y%m%d%H%M%S %z'),
            'stop': bit.astimezone(TZ).strftime('%Y%m%d%H%M%S %z'),
            'channel': xid})
        ET.SubElement(el, 'title', {'lang': 'tr'}).text = baslik
        if aciklama:
            ET.SubElement(el, 'desc', {'lang': 'tr'}).text = aciklama
        toplam += 1

os.makedirs('guides', exist_ok=True)
ET.ElementTree(tv).write('guides/dsmart.com.tr.xml', encoding='utf-8', xml_declaration=True)
print(f'D-Smart toplam: {toplam} program, {len(programlar)} / {len(kanallar)} kanal')
eksik = [c.text for c in kanallar if c.get('xmltv_id') not in programlar]
if eksik:
    print('Verisi olmayan D-Smart kanallari:', ', '.join(eksik))
