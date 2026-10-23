#!/data/data/com.termux/files/usr/bin/sh
# Digiturk yayin akisi erisim testi (Android box / Termux)
for gun in 0 1; do
  tarih=$(date -d "+$gun day" +%m%%2F%d%%2F%Y 2>/dev/null || date +%m%%2F%d%%2F%Y)
  url="https://www.digiturk.com.tr/Ajax/GetTvGuideFromDigiturk?Day=${tarih}+00%3A00%3A00"
  kod=$(curl -s -o "d$gun.html" -w "%{http_code}" -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36" -H "X-Requested-With: XMLHttpRequest" "$url")
  prog=$(grep -o "channelDetail" "d$gun.html" | wc -l)
  boyut=$(wc -c < "d$gun.html")
  echo "Gun +$gun | Durum: $kod | Boyut: $boyut bayt | Program: $prog"
done
