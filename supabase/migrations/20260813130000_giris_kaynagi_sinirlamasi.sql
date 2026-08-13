-- Başarısız giriş sınırı hesap-geneli yerine kaynak + telefon birleşimine uygulanır.
-- Ham IP/adres saklanmaz; yalnız uygulama tarafında üretilen geri döndürülemez özet tutulur.
ALTER TABLE public.giris_denemeleri
  ADD COLUMN IF NOT EXISTS kaynak_ozeti text NOT NULL DEFAULT 'eski-kayit';

DROP INDEX IF EXISTS public.giris_denemeleri_telefon_tarih_idx;
CREATE INDEX IF NOT EXISTS giris_denemeleri_kaynak_telefon_tarih_idx
  ON public.giris_denemeleri (kaynak_ozeti, telefon, deneme_tarihi DESC);

DELETE FROM public.giris_denemeleri
WHERE deneme_tarihi < now() - interval '24 hours';
