-- Denetim kayıtları ekleme-sonrası değiştirilemezdir.
-- Uygulamanın service_role hesabı listeleyebilir ve yeni kayıt ekleyebilir;
-- mevcut satırları güncelleyemez veya silemez.
REVOKE ALL ON TABLE public.audit_loglari FROM service_role;
GRANT SELECT, INSERT ON TABLE public.audit_loglari TO service_role;

CREATE OR REPLACE FUNCTION public.audit_logu_degistirmeyi_engelle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Denetim kayıtları değiştirilemez veya silinemez.';
END;
$$;

DROP TRIGGER IF EXISTS audit_loglari_degistirilemez ON public.audit_loglari;
CREATE TRIGGER audit_loglari_degistirilemez
BEFORE UPDATE OR DELETE ON public.audit_loglari
FOR EACH ROW EXECUTE FUNCTION public.audit_logu_degistirmeyi_engelle();

REVOKE ALL ON FUNCTION public.audit_logu_degistirmeyi_engelle() FROM PUBLIC;
