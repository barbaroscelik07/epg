# tvplus (Turkcell TV+) EPG okuyucu: channels.xml'deki tvplus.com.tr kanallarının programlarını
# tvplus'ın PlayBillList servisinden çeker ve guides/tvplus.com.tr.xml'e yazar.
# iptv-org aracından farkı: yönetmen, oyuncular, tür ve ülke bilgisini de alır;
# açıklamanın başına "Tür / Yönetmen / Oyuncular / Yapım Yeri" satırlarını ekler.
# Yeterli veri gelmezse 1 ile çıkar (iş akışı o zaman eski iptv-org yöntemine döner).
import os, sys, json, time, http.cookiejar, urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo('Europe/Istanbul')
API = 'https://izmaottvsc14.tvplus.com.tr:33207/EPG/JSON/'
GUN = 7            # en fazla bu kadar gün ileri
BEKLE = 1.0        # istekler arası saniye
EN_AZ_KANAL = 30   # bundan az kanalda veri gelirse başarısız say

kanallar = [c for c in ET.parse('channels.xml').getroot().findall('channel') if c.get('site') == 'tvplus.com.tr']

cerez = http.cookiejar.CookieJar()
acici = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cerez))

def istek(yol, govde, deneme=3):
    for i in range(deneme):
        try:
            req = urllib.request.Request(API + yol, json.dumps(govde).encode(),
                                         {'content-type': 'application/json', 'user-agent': 'Mozilla/5.0'})
            with acici.open(req, timeout=60) as r:
                return json.loads(r.read().decode('utf-8', 'replace'))
        except Exception as e:
            hata = e
            time.sleep(3 * (i + 1))
    raise hata

def oturum():
    istek('Authenticate', {'terminaltype': 'webtv', 'terminalvendor': 'Mozilla/5.0', 'osversion': 'Win32',
                           'userType': '3', 'utcEnable': '1', 'timezone': 'Europe/Istanbul'})

def zaman(s):   # "2026-10-28 02:00:00 UTC+03:00"
    try:
        tarih, saat, utc = s.split(' ')
        d = datetime.strptime(f'{tarih} {saat}', '%Y-%m-%d %H:%M:%S')
        isaret = 1 if utc[3] == '+' else -1
        hh, mm = utc[4:].split(':')
        return d - timedelta(hours=isaret * int(hh), minutes=isaret * int(mm))   # UTC
    except Exception:
        return None

def xmltv(d):
    return d.strftime('%Y%m%d%H%M%S +0000')

def liste(v):
    if not v:
        return []
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip()]
    return [x.strip() for x in str(v).split(',') if x.strip()]

def program_ogesi(xid, p):
    bas, bit = zaman(p.get('starttime', '')), zaman(p.get('endtime', ''))
    ad = (p.get('name') or '').strip()
    if not (bas and bit and ad):
        return None
    cast = p.get('cast') or {}
    yonetmen, oyuncu, yapimci = liste(cast.get('director')), liste(cast.get('actor')), liste(cast.get('producer'))
    tur, ulke = liste(p.get('genres')), (p.get('country') or '').strip()
    ozet = (p.get('introduce') or '').strip()
    ust = []
    if tur: ust.append('Tür: ' + ', '.join(tur))
    if yonetmen: ust.append('Yönetmen: ' + ', '.join(yonetmen))
    if oyuncu: ust.append('Oyuncular: ' + ', '.join(oyuncu))
    if ulke: ust.append('Yapım Yeri: ' + ulke)
    aciklama = '\n'.join(ust) + ('\n\n' if ust and ozet else '') + ozet

    e = ET.Element('programme', {'start': xmltv(bas), 'stop': xmltv(bit), 'channel': xid})
    ET.SubElement(e, 'title', {'lang': 'tr'}).text = ad
    if aciklama:
        ET.SubElement(e, 'desc', {'lang': 'tr'}).text = aciklama
    if yonetmen or oyuncu or yapimci:
        kr = ET.SubElement(e, 'credits')
        for x in yonetmen: ET.SubElement(kr, 'director').text = x
        for x in oyuncu: ET.SubElement(kr, 'actor').text = x
        for x in yapimci: ET.SubElement(kr, 'producer').text = x
    for x in tur:
        ET.SubElement(e, 'category', {'lang': 'tr'}).text = x
    resim = next((r.get('href') for r in (p.get('pictures') or []) if r.get('imageType') == '1' and r.get('href')), None)
    if resim:
        ET.SubElement(e, 'icon', {'src': resim})
    if ulke:
        ET.SubElement(e, 'country').text = ulke
    return bas, e

def kanal_programlari(sid, bas, son):
    govde = {'type': '2', 'channelid': sid, 'begintime': bas.strftime('%Y%m%d%H%M%S'),
             'endtime': son.strftime('%Y%m%d%H%M%S'), 'isFillProgram': 1, 'count': '1000', 'offset': '0'}
    return istek('PlayBillList', govde).get('playbilllist') or []

def main():
    oturum()
    bugun = datetime.now(TZ).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    bitis = bugun + timedelta(days=GUN)
    kok = ET.Element('tv', {'generator-info-name': 'epgdeposu-tvplus'})
    programlar, dolu, bos, hatali = [], 0, 0, 0
    gorulen = set()
    for c in kanallar:
        xid, sid = c.get('xmltv_id'), c.get('site_id')
        if xid in gorulen:
            continue
        try:
            # Servis tek cevapta aralığın bir kısmını verebilir: son programın bitişinden devam et
            pl, bas = [], bugun
            for _ in range(GUN + 2):
                parca = kanal_programlari(sid, bas, bitis)
                if not parca:
                    break
                pl += parca
                son_bitis = max((zaman(p.get('endtime', '')) or datetime.min) for p in parca) + timedelta(hours=3)  # yerel saat
                if son_bitis <= bas or son_bitis >= bitis:
                    break
                bas = son_bitis
                time.sleep(BEKLE)
        except Exception as e:
            print(f'{xid}: hata ({str(e)[:100]})'); hatali += 1
            time.sleep(BEKLE); continue
        ogeler, anahtarlar = [], set()
        for p in pl:
            o = program_ogesi(xid, p)
            if o and o[1].get('start') not in anahtarlar:
                anahtarlar.add(o[1].get('start')); ogeler.append(o)
        if ogeler:
            gorulen.add(xid); dolu += 1
            k = ET.SubElement(kok, 'channel', {'id': xid})
            ET.SubElement(k, 'display-name', {'lang': 'tr'}).text = c.text
            programlar += [e for _, e in sorted(ogeler, key=lambda x: x[0])]
        else:
            bos += 1
        time.sleep(BEKLE)
    for e in programlar:
        kok.append(e)
    os.makedirs('guides', exist_ok=True)
    ET.ElementTree(kok).write('guides/tvplus.com.tr.xml', encoding='utf-8', xml_declaration=True)
    ayrintili = sum(1 for e in programlar if e.find('credits') is not None)
    ozet = (f'tvplus okuyucu: {dolu} kanalda veri, {bos} kanal bos, {hatali} kanal hatali; '
            f'{len(programlar)} program ({ayrintili} tanesinde yonetmen/oyuncu bilgisi)')
    print(ozet)
    print('::notice::' + ozet)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as f:
            f.write(f'- {ozet}\n')
    if dolu < EN_AZ_KANAL:
        sys.exit('Yeterli kanal gelmedi, eski yonteme donulecek.')

if __name__ == '__main__':
    main()
