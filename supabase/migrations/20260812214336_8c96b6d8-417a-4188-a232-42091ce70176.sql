CREATE TABLE public.giris_denemeleri (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telefon text NOT NULL,
  deneme_tarihi timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX giris_denemeleri_telefon_tarih_idx
  ON public.giris_denemeleri (telefon, deneme_tarihi DESC);

GRANT ALL ON public.giris_denemeleri TO service_role;

ALTER TABLE public.giris_denemeleri ENABLE ROW LEVEL SECURITY;