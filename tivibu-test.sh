#!/data/data/com.termux/files/usr/bin/sh
# Tivibu EPG sunucusu erisim testi (Android box / Termux) - sadece okuma yapar
H="https://itv224162.tmp.tivibu.com.tr:6430"
D="$HOME/tivibu-test"; mkdir -p "$D"; cd "$D" || exit 1
rm -f jar.txt *.json
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"
K=""
istek() {  # $1=yol $2=json $3=cikti
  curl -s $K --max-time 30 -o "$3" -w "%{http_code}" -A "$UA" -b jar.txt -c jar.txt \
    -H "Content-Type: application/json" -X POST -d "$2" "$H$1"
}
ozet() { printf '%s' "$(head -c 220 "$1" 2>/dev/null | tr -d '\r\n')"; echo; }

echo "== 1) Oturum (Authenticate)"
AUTH='{"terminaltype":"webtv","terminalvendor":"5.0 (Windows NT 10.0; Win64; x64)","osversion":"Win32","userType":"3","utcEnable":"1","timezone":"Europe/Istanbul"}'
kod=$(istek /EPG/JSON/Authenticate "$AUTH" auth.json)
if [ "$kod" = "000" ]; then
  echo "Sertifika/baglanti hatasi, sertifika kontrolu olmadan tekrar deneniyor"
  K="-k"; kod=$(istek /EPG/JSON/Authenticate "$AUTH" auth.json)
fi
echo "Durum: $kod  Cerez: $(grep -c . jar.txt 2>/dev/null) satir"; ozet auth.json

echo "== 2) Kanal listesi (AllChannel)"
kod=$(istek /EPG/JSON/AllChannel '{"properties":[{"name":"logicalChannel","include":"/channellist/logicalChannel/contentId,/channellist/logicalChannel/name"}],"metaDataVer":"Channel/1.1","channelNamespace":"2","filterlist":[{"key":"IsHide","value":"-1"}],"returnSatChannel":0}' kanal.json)
echo "Durum: $kod  Boyut: $(wc -c < kanal.json 2>/dev/null) bayt"; ozet kanal.json
tr ',{}' '\n\n\n' < kanal.json 2>/dev/null | grep -i -B3 -A3 'tivibu spor' | head -30 > tivibu-kanallar.txt
echo "Tivibu Spor gecen satirlar:"; cat tivibu-kanallar.txt

echo "== 3) Program listesi (PlayBillList)"
ID=$(tr ',{}' '\n\n\n' < kanal.json 2>/dev/null | grep -i -B5 'tivibu spor 1' | grep -oE '"(contentId|id|channelid)" *: *"?[0-9]+' | grep -oE '[0-9]+$' | tail -1)
echo "Denenen kanal kimligi: ${ID:-bulunamadi}"
if [ -n "$ID" ]; then
  bas=$(date -u +%Y%m%d000000); bit=$(date -u -d '+1 day' +%Y%m%d000000)
  kod=$(istek /EPG/JSON/PlayBillList "{\"type\":\"2\",\"channelid\":\"$ID\",\"begintime\":\"$bas\",\"endtime\":\"$bit\",\"isFillProgram\":1}" prog.json)
  echo "Durum: $kod  Program: $(grep -o '"name"' prog.json 2>/dev/null | wc -l | tr -d ' ')"; ozet prog.json
fi
echo "== Bitti. Dosyalar: $D"
