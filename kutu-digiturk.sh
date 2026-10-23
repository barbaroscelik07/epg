#!/data/data/com.termux/files/usr/bin/sh
# Digiturk 7 gunluk yayin akisini indirip EPG Worker'ina yukler (Android box / Termux)
WORKER="https://epg.barbaroscelik.workers.dev"
ARALIK=21600
SIFRE=$(cat "$HOME/.epg/sifre")
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"
TMP="$HOME/.epg/tmp"
mkdir -p "$TMP"
tekrar_dene() { echo $(( $(date +%s) - ARALIK + 1800 )) > "$HOME/.epg/son"; }   # 30 dk sonra tekrar

echo "== $(date '+%Y-%m-%d %H:%M') Digiturk guncelleme"
i=0
until curl -s -o /dev/null --max-time 15 https://www.digiturk.com.tr; do
  i=$((i + 1))
  if [ "$i" -ge 20 ]; then echo "Internet yok, 30 dk sonra tekrar"; tekrar_dene; exit 1; fi
  sleep 30
done

basarili=0
for g in 0 1 2 3 4 5 6; do
  anahtar=$(date -d "+$g day" +%Y-%m-%d)
  param=$(date -d "+$g day" +%m%%2F%d%%2F%Y)
  dosya="$TMP/$anahtar.html"
  kod=000
  for deneme in 1 2 3; do
    kod=$(curl -s --max-time 120 -o "$dosya" -w "%{http_code}" -A "$UA" \
      -H "X-Requested-With: XMLHttpRequest" \
      "https://www.digiturk.com.tr/Ajax/GetTvGuideFromDigiturk?Day=${param}+00%3A00%3A00")
    [ "$kod" = "200" ] && break
    sleep 10
  done
  prog=$(grep -o channelDetail "$dosya" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$kod" != "200" ] || [ "${prog:-0}" -lt 100 ]; then
    echo "$anahtar: Digiturk $kod, $prog program - atlandi"; continue
  fi
  yukle="$dosya"
  if command -v gzip >/dev/null 2>&1 && gzip -c "$dosya" > "$dosya.gz"; then yukle="$dosya.gz"; fi
  sonuc=$(curl -s --max-time 120 -X PUT -H "X-Yukleme-Sifresi: $SIFRE" \
    --data-binary @"$yukle" -w " [%{http_code}]" "$WORKER/yukle/digiturk-$anahtar")
  echo "$anahtar: $prog program -> $sonuc"
  case "$sonuc" in *"[200]"*) basarili=$((basarili + 1)) ;; esac
done
rm -rf "$TMP"
if [ "$basarili" -gt 0 ]; then date +%s > "$HOME/.epg/son"; else tekrar_dene; fi
echo "Tamam: $basarili/7 gun yuklendi"
