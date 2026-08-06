-- Remove overly permissive public policies; access moves to trusted server code (service_role)
DROP POLICY IF EXISTS bloklar_all ON public.bloklar;
DROP POLICY IF EXISTS gorevler_all ON public.gorevler;
DROP POLICY IF EXISTS is_loglari_all ON public.is_loglari;
DROP POLICY IF EXISTS personel_all ON public.personel;

REVOKE ALL ON public.bloklar FROM anon, authenticated;
REVOKE ALL ON public.gorevler FROM anon, authenticated;
REVOKE ALL ON public.is_loglari FROM anon, authenticated;
REVOKE ALL ON public.personel FROM anon, authenticated;

GRANT ALL ON public.bloklar TO service_role;
GRANT ALL ON public.gorevler TO service_role;
GRANT ALL ON public.is_loglari TO service_role;
GRANT ALL ON public.personel TO service_role;

-- Job photos: no public read/write on the private bucket
DROP POLICY IF EXISTS is_fotolari_read ON storage.objects;
DROP POLICY IF EXISTS is_fotolari_insert ON storage.objects;
DROP POLICY IF EXISTS is_fotolari_update ON storage.objects;