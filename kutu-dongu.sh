#!/data/data/com.termux/files/usr/bin/sh
# 6 saatte bir digiturk.sh calistirir; her seferinde guncel betigi GitHub'dan alir
DEPO="https://raw.githubusercontent.com/barbaroscelik07/epg/main"
ARALIK=21600
PIDF="$HOME/.epg/dongu.pid"
if [ -f "$PIDF" ]; then
  p=$(cat "$PIDF")
  if [ -r "/proc/$p/cmdline" ] && grep -q dongu.sh "/proc/$p/cmdline" 2>/dev/null; then exit 0; fi
fi
echo $$ > "$PIDF"
while true; do
  if [ -f "$HOME/.epg/son" ]; then
    gecen=$(( $(date +%s) - $(cat "$HOME/.epg/son") ))
    if [ "$gecen" -lt "$ARALIK" ]; then sleep $(( ARALIK - gecen )); fi
  fi
  if curl -fsSL --max-time 60 "$DEPO/kutu-digiturk.sh" -o "$HOME/.epg/digiturk.yeni" && [ -s "$HOME/.epg/digiturk.yeni" ]; then
    mv "$HOME/.epg/digiturk.yeni" "$HOME/.epg/digiturk.sh"
  fi
  sh "$HOME/.epg/digiturk.sh" >> "$HOME/.epg/log.txt" 2>&1
  tail -n 300 "$HOME/.epg/log.txt" > "$HOME/.epg/log.tmp" && mv "$HOME/.epg/log.tmp" "$HOME/.epg/log.txt"
  sleep 60
done
