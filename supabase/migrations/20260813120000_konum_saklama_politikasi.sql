-- KVKK veri minimizasyonu: hassas personel konumları en fazla 30 gün saklanır.
-- Bu migration mevcut eski kayıtları temizler ve günlük otomatik temizlik kurar.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DELETE FROM public.personel_konumlari
WHERE kayit_tarihi < now() - interval '30 days';

SELECT cron.schedule(
  'personel-konumlari-30-gun-temizligi',
  '17 3 * * *',
  $$DELETE FROM public.personel_konumlari
    WHERE kayit_tarihi < now() - interval '30 days'$$
);
