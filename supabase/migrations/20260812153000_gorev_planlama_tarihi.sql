-- Takvimde geçmiş işleri ve ileri tarihli planları ayrı günlerde göstermek için.
ALTER TABLE public.gorevler
  ADD COLUMN IF NOT EXISTS planlanan_tarih date;

UPDATE public.gorevler
SET planlanan_tarih = olusturma_tarihi::date
WHERE planlanan_tarih IS NULL;

ALTER TABLE public.gorevler
  ALTER COLUMN planlanan_tarih SET DEFAULT CURRENT_DATE,
  ALTER COLUMN planlanan_tarih SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gorevler_planlanan_tarih
  ON public.gorevler (planlanan_tarih);
