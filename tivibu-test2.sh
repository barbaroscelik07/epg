#!/data/data/com.termux/files/usr/bin/sh
# Tivibu web sitesi yayin akisi testi (WebGrab+Plus tivibu.com.tr.ini yontemi) - sadece okuma
D="$HOME/tivibu-test"; mkdir -p "$D"; cd "$D" || exit 1
rm -f jar2.txt canli.html prevue.json kanal.html
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"
ozet() { printf '%s' "$(head -c 200 "$1" 2>/dev/null | tr -d '\r\n')"; echo; }

echo "== 1) Canli TV sayfasi ve guvenlik anahtari"
kod=$(curl -s --compressed --max-time 30 -o canli.html -w "%{http_code}" -A "$UA" -c jar2.txt -b jar2.txt \
  "https://www.tivibu.com.tr/canli-tv")
TOKEN=$(grep -o '<input[^>]*CSRF-TOKEN-TVBUDNBX[^>]*>' canli.html | sed -n 's/.*value="\([^"]*\)".*/\1/p' | head -1)
echo "Durum: $kod  Boyut: $(wc -c < canli.html) bayt  Anahtar: $( [ -n "$TOKEN" ] && echo "bulundu (${#TOKEN} karakter)" || echo YOK)"
[ -z "$TOKEN" ] && ozet canli.html

echo "== 2) Tivibu Spor 1 - 7 gunluk akis (GetPrevueList)"
bas=$(date +%Y.%m.%d); bit=$(date -d '+6 day' +%Y.%m.%d)
kod=$(curl -s --compressed --max-time 60 -o prevue.json -w "%{http_code}" -A "$UA" -c jar2.txt -b jar2.txt \
  -H "X-Requested-With: XMLHttpRequest" -H "RequestVerificationToken: $TOKEN" \
  -H "Origin: https://www.tivibu.com.tr" -H "Referer: https://www.tivibu.com.tr/canli-tv" \
  -H "Content-Type: application/x-www-form-urlencoded; charset=UTF-8" \
  --data "channelCode=ch00000000000000001356&channelDateBegin=${bas}+00%3A00%3A00&channelDateEnd=${bit}+23%3A59%3A59" \
  "https://www.tivibu.com.tr/Channel/GetPrevueList")
adet=$(grep -o '"prevueName"' prevue.json 2>/dev/null | wc -l | tr -d ' ')
echo "Durum: $kod  Boyut: $(wc -c < prevue.json) bayt  Program: $adet"
if [ "${adet:-0}" -gt 0 ]; then
  echo "Ilk:  $(grep -o '"beginTime":"[^"]*"' prevue.json | head -1)  $(grep -o '"prevueName":"[^"]*"' prevue.json | head -1)"
  echo "Son:  $(grep -o '"beginTime":"[^"]*"' prevue.json | tail -1)"
else
  ozet prevue.json
fi

echo "== 3) Yedek: Tivibu Spor 1 kanal sayfasi"
kod=$(curl -s --compressed --max-time 30 -o kanal.html -w "%{http_code}" -A "$UA" "https://www.tivibu.com.tr/kanallar/tivibu-spor-1")
echo "Durum: $kod  Boyut: $(wc -c < kanal.html) bayt  'Bozok/Lig/Spor' gecen satir: $(grep -c -i 'lig\|spor' kanal.html)"
echo "== Bitti"
