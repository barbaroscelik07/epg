#!/data/data/com.termux/files/usr/bin/sh
# Digiturk 7 gunluk yayin akisini indirip EPG Worker'ina yukler (Android box / Termux)
WORKER="https://epg.epgdeposu.workers.dev"
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
echo "Digiturk: $basarili/7 gun yuklendi"

# ---- D-Smart (sayfali API; her sayfa bir satir olarak birlestirilir) ----
ds_basarili=0
for g in 0 1 2 3 4 5 6; do
  anahtar=$(date -d "+$g day" +%Y-%m-%d)
  dosya="$TMP/ds-$anahtar.txt"
  : > "$dosya"
  sayfa=1; kod=000
  while [ "$sayfa" -le 40 ]; do
    kod=$(curl -s --max-time 60 -o "$TMP/sayfa.json" -w "%{http_code}" -A "$UA" \
      "https://www.dsmart.com.tr/api/v1/public/epg/schedules?page=${sayfa}&limit=10&day=${anahtar}")
    [ "$kod" = "200" ] || break
    grep -Eq '"channels": ?\[\]' "$TMP/sayfa.json" && break
    tr -d '\r\n' < "$TMP/sayfa.json" >> "$dosya"; echo >> "$dosya"
    sayfa=$((sayfa + 1))
  done
  prog=$(grep -o '"program_name"' "$dosya" 2>/dev/null | wc -l | tr -d ' ')
  if [ "${prog:-0}" -lt 100 ]; then
    echo "ds $anahtar: D-Smart $kod, $prog program - atlandi"; continue
  fi
  yukle="$dosya"
  if command -v gzip >/dev/null 2>&1 && gzip -c "$dosya" > "$dosya.gz"; then yukle="$dosya.gz"; fi
  sonuc=$(curl -s --max-time 120 -X PUT -H "X-Yukleme-Sifresi: $SIFRE" \
    --data-binary @"$yukle" -w " [%{http_code}]" "$WORKER/yukle/dsmart-$anahtar")
  echo "ds $anahtar: $((sayfa - 1)) sayfa, $prog program -> $sonuc"
  case "$sonuc" in *"[200]"*) ds_basarili=$((ds_basarili + 1)) ;; esac
done
echo "D-Smart: $ds_basarili/7 gun yuklendi"

# ---- Tivibu (web sitesi; kanal listesi GitHub'daki channels.xml'den) ----
tv_basarili=0
KANALLAR=$(curl -fsSL --max-time 60 "https://raw.githubusercontent.com/barbaroscelik07/epg/main/channels.xml" \
  | grep -o 'site="tivibu\.com\.tr"[^>]*site_id="[0-9]*"' | grep -o '[0-9]*"$' | tr -d '"' | sort -u)
if [ -n "$KANALLAR" ]; then
  curl -s --compressed --max-time 60 -o "$TMP/canli.html" -A "$UA" -c "$TMP/jar" -b "$TMP/jar" \
    "https://www.tivibu.com.tr/canli-tv"
  TOKEN=$(grep -o '<input[^>]*CSRF-TOKEN-TVBUDNBX[^>]*>' "$TMP/canli.html" | sed -n 's/.*value="\([^"]*\)".*/\1/p' | head -1)
  bas=$(date +%Y.%m.%d); bit=$(date -d '+6 day' +%Y.%m.%d)
  dosya="$TMP/tivibu.txt"; : > "$dosya"; adet=0; kanal_say=0
  for k in $KANALLAR; do
    kanal_say=$((kanal_say + 1))
    curl -s --compressed --max-time 60 -o "$TMP/tv.json" -A "$UA" -c "$TMP/jar" -b "$TMP/jar" \
      -H "X-Requested-With: XMLHttpRequest" -H "RequestVerificationToken: $TOKEN" \
      -H "Origin: https://www.tivibu.com.tr" -H "Referer: https://www.tivibu.com.tr/canli-tv" \
      -H "Content-Type: application/x-www-form-urlencoded; charset=UTF-8" \
      --data "channelCode=ch${k}&channelDateBegin=${bas}+00%3A00%3A00&channelDateEnd=${bit}+23%3A59%3A59" \
      "https://www.tivibu.com.tr/Channel/GetPrevueList"
    if grep -q '"prevueName"' "$TMP/tv.json" 2>/dev/null; then
      printf '%s\t' "$k" >> "$dosya"; tr -d '\r\n' < "$TMP/tv.json" >> "$dosya"; echo >> "$dosya"
      adet=$((adet + 1))
    fi
    sleep 1
  done
  if [ "$adet" -gt 0 ]; then
    yukle="$dosya"
    if command -v gzip >/dev/null 2>&1 && gzip -c "$dosya" > "$dosya.gz"; then yukle="$dosya.gz"; fi
    sonuc=$(curl -s --max-time 120 -X PUT -H "X-Yukleme-Sifresi: $SIFRE" \
      --data-binary @"$yukle" -w " [%{http_code}]" "$WORKER/yukle/tivibu-$(date +%Y-%m-%d)")
    echo "Tivibu: $adet/$kanal_say kanal -> $sonuc"
    case "$sonuc" in *"[200]"*) tv_basarili=1 ;; esac
  else
    echo "Tivibu: $kanal_say kanalin hicbirinden veri gelmedi (anahtar: $( [ -n "$TOKEN" ] && echo var || echo yok))"
  fi
fi

rm -rf "$TMP"
if [ $((basarili + ds_basarili + tv_basarili)) -gt 0 ]; then date +%s > "$HOME/.epg/son"; else tekrar_dene; fi
echo "Tamam."
