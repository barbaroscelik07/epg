#!/data/data/com.termux/files/usr/bin/sh
# Kurulum: curl -sL https://raw.githubusercontent.com/barbaroscelik07/epg/main/kutu-kur.sh | sh -s SIFRE
DEPO="https://raw.githubusercontent.com/barbaroscelik07/epg/main"
SIFRE="$1"
if [ -z "$SIFRE" ]; then echo "HATA: sifre yazilmadi. Komutun sonuna sifreyi ekleyin."; exit 1; fi
mkdir -p "$HOME/.epg" "$HOME/.termux/boot"
printf '%s' "$SIFRE" > "$HOME/.epg/sifre"
chmod 600 "$HOME/.epg/sifre"
for f in digiturk.sh dongu.sh; do
  curl -fsSL "$DEPO/kutu-$f" -o "$HOME/.epg/$f" || { echo "HATA: $f indirilemedi"; exit 1; }
done
cat > "$HOME/.termux/boot/epg-baslat" <<'BOOT'
#!/data/data/com.termux/files/usr/bin/sh
termux-wake-lock
nohup sh "$HOME/.epg/dongu.sh" > /dev/null 2>&1 &
BOOT
chmod +x "$HOME/.termux/boot/epg-baslat"
echo "Ilk calisma basliyor (birkac dakika surebilir)..."
sh "$HOME/.epg/digiturk.sh"
sh "$HOME/.termux/boot/epg-baslat"
echo "KURULUM TAMAM. Box her acildiginda otomatik calisacak."
