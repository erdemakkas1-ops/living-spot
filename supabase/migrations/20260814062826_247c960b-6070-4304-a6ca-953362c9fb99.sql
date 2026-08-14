CREATE TABLE IF NOT EXISTS public.konum_izinleri (
  personel_id uuid PRIMARY KEY REFERENCES public.personel(id) ON DELETE CASCADE,
  izin_verildi boolean NOT NULL DEFAULT false,
  metin_surumu text NOT NULL DEFAULT '2026-08-14-v1',
  verildi_at timestamptz,
  geri_cekildi_at timestamptz,
  guncellendi_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.konum_izinleri ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.konum_izinleri FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.konum_izinleri TO service_role;