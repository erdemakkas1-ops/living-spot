# Yedekleme, Destek ve Güncelleme Prosedürü

## Yedekleme

- Veritabanı yedeği: günlük; saklama süresi sözleşmede belirtilir.
- Kritik secret ve Android keystore: şifreli parola kasasında iki yetkili yedek.
- Fotoğraf yedeklerinin KVKK saklama süresini aşmaması sağlanır.
- Ayda en az bir kez otomatik yedek sonucu kontrol edilir.
- Üç ayda bir izole ortamda geri yükleme testi yapılır ve kayıt altına alınır.

## Destek sınıfları

- Kritik: giriş yapılamıyor, veri sızıntısı şüphesi, sistem tamamen kapalı.
- Yüksek: görev/fotoğraf/konum ana akışlarından biri çalışmıyor.
- Normal: görsel hata, rapor veya kullanım sorusu.

Sözleşmeye yazılacak hedefler:

- Kritik ilk yanıt: `[DOLDURULACAK]`
- Yüksek ilk yanıt: `[DOLDURULACAK]`
- Normal ilk yanıt: `[DOLDURULACAK]`
- Destek saatleri ve kanalı: `[DOLDURULACAK]`

## Güncelleme akışı

1. Değişiklik ayrı dalda hazırlanır ve güvenlik incelemesinden geçirilir.
2. TypeScript, production build, Android lint ve kabul testleri çalıştırılır.
3. Veritabanı migration'ı varsa önce yedek alınır ve migration uygulanır.
4. Web sürümü yayınlanır; sağlık kutusu ve ana akışlar doğrulanır.
5. Mobil sürüm gerekiyorsa version code/name artırılır ve aynı keystore ile imzalanır.
6. Geri dönüş planı ve sürüm notu müşteriyle paylaşılır.

Üretimde force-push, geçmişi yeniden yazma veya aynı Android uygulamasını farklı keystore ile imzalama yapılmaz.

