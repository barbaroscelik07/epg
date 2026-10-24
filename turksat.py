# Türksat Kablo EPG çekici: kanalları "n" (kanal adı) alanıyla eşleştirir.
# channels.xml'deki turksatkablo.com.tr satırlarında site_id = Türksat'taki kanal adı.
import os, sys, json, ssl, time, urllib.request, urllib.error, email.utils
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

TZ = ZoneInfo('Europe/Istanbul')
GUN = int(os.environ.get('GUN', '3'))
TEST_DIR = os.environ.get('TURKSAT_TEST_DIR')   # yerel test için

ctx = ssl.create_default_context()
if os.path.exists('inter.pem'):
    ctx.load_verify_locations('inter.pem')       # eksik ara sertifika

kanallar = [c for c in ET.parse('channels.xml').getroot().findall('channel')
            if c.get('site') == 'turksatkablo.com.tr']

def indir(tarih):
    ad = tarih.strftime('%d') + '.json'
    if TEST_DIR:
        return json.load(open(os.path.join(TEST_DIR, ad), encoding='utf-8-sig')), None
    req = urllib.request.Request(f'https://www.turksatkablo.com.tr/userUpload/EPG/{ad}',
                                 headers={'User-Agent': 'Mozilla/5.0'})
    for deneme in range(1, 4):      # geçici ağ/DNS hatalarında 3 kez, 30 sn arayla dene
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=60) as r:
                lm = r.headers.get('Last-Modified')
                return json.loads(r.read().decode('utf-8-sig')), lm
        except urllib.error.HTTPError:
            raise                       # sunucu cevap verdi (ör. 404): tekrar denemenin anlamı yok
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            if deneme == 3:
                raise
            print(f'{ad}: baglanti hatasi ({e}), {deneme}. deneme - 30 sn sonra tekrar')
            time.sleep(30)

def zaman(gun, saat):
    h, m = map(int, saat.split(':'))
    return datetime(gun.year, gun.month, gun.day, h, m, tzinfo=TZ)

tv = ET.Element('tv')
for c in kanallar:
    ch = ET.SubElement(tv, 'channel', {'id': c.get('xmltv_id')})
    ET.SubElement(ch, 'display-name', {'lang': 'tr'}).text = c.text

bugun = datetime.now(TZ).date()
toplam, bulunamayan, liste, yuklenen = 0, set(), {}, set()
for g in range(GUN):
    tarih = bugun + timedelta(days=g)
    try:
        veri, lm = indir(tarih)
    except Exception as e:
        print(f'{tarih}: indirilemedi ({e})'); continue
    if lm:  # ayın aynı günü olan eski (geçen ayın) dosyasını kullanma
        degisme = email.utils.parsedate_to_datetime(lm).astimezone(TZ).date()
        if (tarih - degisme).days > 7:
            print(f'{tarih}: dosya eski ({degisme}), atlandi'); continue
    adlar = {}
    for k in veri.get('k', []):
        adlar.setdefault(k.get('n'), k.get('p', []))
    sayi = 0
    for c in kanallar:
        progs = adlar.get(c.get('site_id'))
        if progs is None:
            bulunamayan.add(c.get('site_id')); continue
        gun, onceki = tarih, None
        for p in progs:
            if not p.get('b') or p['b'].strip() == '-':
                continue
            bas = zaman(gun, p['c'])
            if onceki and bas < onceki:
                bas += timedelta(days=1); gun += timedelta(days=1)
            bit = zaman(gun, p['d'])
            if bit <= bas:
                bit += timedelta(days=1)
            onceki = bas
            liste.setdefault(c.get('xmltv_id'), []).append((bas, bit, p['b'].strip(), tarih))
            sayi += 1
    yuklenen.add(tarih)
    print(f'{tarih}: {sayi} program')

# Bir günün dosyasından ertesi güne taşan programları, ertesi günün kendi dosyası
# varsa at; sonra kalan çakışmaları temizle.
for xid, progs in liste.items():
    progs = [p for p in progs if p[0].date() == p[3] or p[0].date() not in yuklenen]
    son_bit, son_el, son_bas = None, None, None
    for bas, bit, baslik, _ in sorted(progs):
        if son_bas and bas == son_bas:
            continue                      # aynı başlangıç: tekrar
        if son_bit and bas < son_bit:     # çakışma: öncekinin bitişini kısalt
            son_el.set('stop', bas.strftime('%Y%m%d%H%M%S %z'))
        el = ET.SubElement(tv, 'programme', {
            'start': bas.strftime('%Y%m%d%H%M%S %z'),
            'stop': bit.strftime('%Y%m%d%H%M%S %z'),
            'channel': xid})
        ET.SubElement(el, 'title', {'lang': 'tr'}).text = baslik
        son_bit, son_el, son_bas = bit, el, bas; toplam += 1

os.makedirs('guides', exist_ok=True)
ET.ElementTree(tv).write('guides/turksatkablo.com.tr.xml', encoding='utf-8', xml_declaration=True)
print(f'Turksat toplam: {toplam} program, {len(kanallar)} kanal')
if bulunamayan:
    print('Turksat dosyasinda adi bulunamayan kanallar:', ', '.join(sorted(bulunamayan)))
