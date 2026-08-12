ALTER TABLE public.gorevler ADD COLUMN IF NOT EXISTS planlanan_tarih date;

UPDATE public.gorevler SET planlanan_tarih = (olusturma_tarihi AT TIME ZONE 'Europe/Istanbul')::date WHERE planlanan_tarih IS NULL;

ALTER TABLE public.gorevler ALTER COLUMN planlanan_tarih SET DEFAULT CURRENT_DATE;
ALTER TABLE public.gorevler ALTER COLUMN planlanan_tarih SET NOT NULL;