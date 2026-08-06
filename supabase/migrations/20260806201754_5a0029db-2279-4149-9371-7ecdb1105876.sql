CREATE TABLE public.personel_konumlari (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personel_id uuid NOT NULL REFERENCES public.personel(id) ON DELETE CASCADE,
  enlem double precision NOT NULL,
  boylam double precision NOT NULL,
  dogruluk double precision,
  kayit_tarihi timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX personel_konumlari_personel_tarih_idx ON public.personel_konumlari (personel_id, kayit_tarihi DESC);
GRANT SELECT, INSERT ON public.personel_konumlari TO anon, authenticated;
GRANT ALL ON public.personel_konumlari TO service_role;
ALTER TABLE public.personel_konumlari ENABLE ROW LEVEL SECURITY;
CREATE POLICY personel_konumlari_all ON public.personel_konumlari FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);