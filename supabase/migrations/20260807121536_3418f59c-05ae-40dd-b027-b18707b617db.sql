DROP POLICY IF EXISTS personel_konumlari_all ON public.personel_konumlari;

REVOKE ALL ON public.personel_konumlari FROM anon, authenticated;
GRANT ALL ON public.personel_konumlari TO service_role;

ALTER TABLE public.personel_konumlari ENABLE ROW LEVEL SECURITY;