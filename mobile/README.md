# Saha İş Takip Android

Android uygulaması, canlı PWA'yı Trusted Web Activity (TWA) içinde çalıştıracak şekilde hazırlanır.

## Sabit kimlikler

- Uygulama adı: `Saha İş Takip`
- Paket kimliği: `com.livingspot.sahais`
- Canlı origin: `https://living-spot.lovable.app`
- Web manifesti: `https://living-spot.lovable.app/manifest.webmanifest`

Paket kimliği Play Store yayını başladıktan sonra değiştirilmez.

## Güvenlik sırası

1. Android imzalama anahtarı çevrimdışı oluşturulur ve yedeklenir.
2. Sertifikanın SHA-256 parmak izi alınır.
3. Gerçek parmak iziyle `public/.well-known/assetlinks.json` oluşturulur.
4. Alan adı doğrulandıktan sonra APK/AAB üretilir.
5. Push cihaz kaydı, giriş onayı ve arka plan konum izinleri ayrı güvenlik incelemesinden geçirilir.

İmzalama parmak izi oluşmadan sahte veya geçici `assetlinks.json` yayınlanmaz.
