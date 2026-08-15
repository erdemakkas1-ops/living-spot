# Güvenlik ve KVKK operasyon notları

Bu belge, kodla tek başına garanti edilemeyen üretim kontrollerini tanımlar.

## Yayın sırası

1. Yeni Supabase migration dosyalarını canlı veritabanına uygula.
2. Yönetim panelindeki `KVKK veri saklama kontrolü` satırında bütün kontrollerin yeşil olduğunu doğrula.
3. Web uygulamasını yayınla.
4. Yönetici ve personel girişlerini, MFA'yı, görev başlatma/tamamlama, fotoğraf ve konum akışını test et.
5. Android sürümünü aynı web sürümü doğrulandıktan sonra üret.

## Yönetici MFA kurulumu

- Yeni veya sıfırlanmış yönetici hesabında ilk kurulum sırasında `SAHA_MFA_BOOTSTRAP_ENABLED=true` geçici olarak tanımlanır.
- Authenticator kurulumu ve kurtarma kodu doğrulandıktan hemen sonra bu secret silinir veya `false` yapılır.
- Normal üretim çalışmasında açık bırakılmaz.
- Kurtarma kodları ve Android imzalama anahtarı parola kasasında, en az iki yetkili tarafından erişilebilir yedekle saklanır.

## Saklama ve günlük kontrol

- Konum: 30 gün; görev fotoğrafı/logu: 180 gün; audit: 730 gün; personel bildirimi: 180 gün.
- Uygulama günlük temizliği aktif oturum sırasında da çalıştırır. Panelde son bakım 48 saati geçerse olay kaydı açılmalıdır.
- Supabase cron görevleri, özel fotoğraf bucket'ı, RLS, public grant/RPC ve audit kilidi panelde her gün doğrulanır.
- Fotoğraf silme işlemi Storage API gerektirdiğinden yalnız SQL satırı silinerek yapılmaz; dosya silindikten sonra veritabanı kaydı temizlenir.

## Mobil yayın

- `mobile/android/.keys/` ve `*.keystore` Git'e eklenmez.
- Google Play App Signing etkinleştirildiğinde Play Console'daki SHA-256 sertifika parmak izi `public/.well-known/assetlinks.json` dosyasına ayrıca eklenir.
- Her sürümde Android `lintRelease`, APK imza doğrulaması ve gerçek cihazda giriş/çıkış, çevrimdışı kuyruk, fotoğraf ve mesai içi/dışı konum testleri yapılır.

## Sınırlar ve hukuki kontroller

- GPS koordinatı ve yüklenen fotoğraf tek başına fiziksel bulunma veya canlı kamera kanıtı sayılmaz. Böyle bir kanıt gerekiyorsa cihaz bütünlüğü doğrulaması, geofence ve yalnız uygulama içi kamera politikası ayrı bir ürün kararı olarak tasarlanır.
- Personel silinirken aydınlatma/onay delilinin saklanması veya anonimleştirilmesi, şirketin hukuk danışmanının belirlediği saklama politikasına göre uygulanır.
- Canlıya geçmeden önce KVKK envanteri, aydınlatma metinleri, hukuki sebep, veri işleyen sözleşmeleri, yurt dışı aktarım şartları, veri sahibi başvuru ve ihlal müdahale süreçleri hukuk danışmanı tarafından onaylanır.
