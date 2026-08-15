-- Audit kayıtları yalnız 730 günlük KVKK saklama temizliği sırasında silinebilir;
-- diğer UPDATE/DELETE işlemleri service_role dahil engellenir.
CREATE OR REPLACE FUNCTION public.audit_logu_degistirmeyi_engelle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('app.kvkk_retention_cleanup', true) = 'on'
     AND OLD.created_at < now() - interval '730 days' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Denetim kayıtları değiştirilemez veya silinemez.';
END;
$$;

DROP TRIGGER IF EXISTS audit_loglari_degistirilemez ON public.audit_loglari;
CREATE TRIGGER audit_loglari_degistirilemez
BEFORE UPDATE OR DELETE ON public.audit_loglari
FOR EACH ROW EXECUTE FUNCTION public.audit_logu_degistirmeyi_engelle();

REVOKE ALL ON FUNCTION public.audit_logu_degistirmeyi_engelle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.audit_loglari FROM service_role;
GRANT SELECT, INSERT ON TABLE public.audit_loglari TO service_role;
