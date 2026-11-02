# Kurulum

## Nasıl çalışıyor

Görseller bu depoda, herkese açık HTTPS adreslerinde duruyor.
Instagram Graph API görseli kendisi indirdiği için gereken buydu.
`paylas.js` sadece Meta'ya "şu adresteki görseli paylaş" diyor.
Yükleme, FTP, SSH adımı yok.

## Kurulum

```bash
git clone https://github.com/LAICOS-LTD/balsis-gorseller.git
cd balsis-gorseller
cp .env.example .env
open -e .env          # IG_ACCESS_TOKEN ve FB_PAGE_TOKEN doldur
node paylas.js test
```

`test` komutu hesabı, sayfayı ve 20 görselin hepsini kontrol eder.

## Günlük otomasyon

```bash
node paylas.js sirada
```

Bunu her gün 10:00 ve 17:00'de çalıştırmak için, bu klasörde:

```bash
cat > ~/Library/LaunchAgents/com.balsis.sosyal.plist <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.balsis.sosyal</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(command -v node)</string>
    <string>$(pwd)/paylas.js</string>
    <string>sirada</string>
  </array>
  <key>WorkingDirectory</key><string>$(pwd)</string>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>10</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>17</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>StandardOutPath</key><string>$(pwd)/launchd.log</string>
  <key>StandardErrorPath</key><string>$(pwd)/launchd.log</string>
</dict></plist>
PL
launchctl load ~/Library/LaunchAgents/com.balsis.sosyal.plist
```

Durdurmak için:
`launchctl unload ~/Library/LaunchAgents/com.balsis.sosyal.plist`

## Elle paylaşım

```bash
node paylas.js story gun-03
node paylas.js post  gun-03
```

## Takvim

`plan.json` — 3 Kasım'dan 12 Kasım'a, her gün 10:00 story / 17:00 post.
Paylaşılanlar `yapildi` damgası alır, iki kez paylaşılmaz.

## Dikkat

- Bilgisayar kapalı veya uykudaysa o saatteki paylaşım atlanır.
  Bir sonraki çalışmada sırası gelen iş yapılır.
- Meta erişim tokeni 60 günde bir yenilenir.
- `.env` git'e girmez, şifre ve token oraya yazılır.
