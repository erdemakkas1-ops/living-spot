-- Uygulama tüm veri erişimini service_role kullanan sunucu fonksiyonlarından yapar.
-- Kritik tablolar doğrudan PostgREST anon/authenticated erişimine tamamen kapatılır.
ALTER TABLE public.bloklar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloklar FORCE ROW LEVEL SECURITY;
ALTER TABLE public.personel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personel FORCE ROW LEVEL SECURITY;
ALTER TABLE public.gorevler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gorevler FORCE ROW LEVEL SECURITY;
ALTER TABLE public.is_loglari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.is_loglari FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_loglari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_loglari FORCE ROW LEVEL SECURITY;
ALTER TABLE public.personel_konumlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personel_konumlari FORCE ROW LEVEL SECURITY;
ALTER TABLE public.konum_izinleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.konum_izinleri FORCE ROW LEVEL SECURITY;
ALTER TABLE public.personel_konum_takip_saatleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personel_konum_takip_saatleri FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sistem_bakim_durumu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sistem_bakim_durumu FORCE ROW LEVEL SECURITY;
ALTER TABLE public.personel_bildirimleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personel_bildirimleri FORCE ROW LEVEL SECURITY;
ALTER TABLE public.giris_denemeleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giris_denemeleri FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.bloklar, public.personel, public.gorevler, public.is_loglari,
  public.audit_loglari, public.personel_konumlari, public.konum_izinleri,
  public.personel_konum_takip_saatleri, public.sistem_bakim_durumu,
  public.personel_bildirimleri, public.giris_denemeleri
FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE
  public.bloklar, public.personel, public.gorevler, public.is_loglari,
  public.personel_konumlari, public.konum_izinleri,
  public.personel_konum_takip_saatleri, public.personel_bildirimleri,
  public.giris_denemeleri
TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.sistem_bakim_durumu TO service_role;
GRANT SELECT, INSERT ON TABLE public.audit_loglari TO service_role;

CREATE OR REPLACE FUNCTION public.guvenlik_yapilandirmasi_dogrula()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rls boolean := false;
  v_public_yetki_yok boolean := false;
  v_cron boolean := false;
  v_tablolar text[] := ARRAY[
    'bloklar','personel','gorevler','is_loglari','audit_loglari','personel_konumlari',
    'konum_izinleri','personel_konum_takip_saatleri','sistem_bakim_durumu',
    'personel_bildirimleri','giris_denemeleri'
  ];
BEGIN
  SELECT count(*) = cardinality(v_tablolar)
         AND bool_and(c.relrowsecurity AND c.relforcerowsecurity)
    INTO v_rls
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = ANY (v_tablolar);

  SELECT NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY (v_tablolar)
      AND (
        pg_catalog.has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
        OR pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
      )
  ) INTO v_public_yetki_yok;

  IF pg_catalog.to_regclass('cron.job') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = $1 AND active)'
        INTO v_cron USING 'audit-loglari-2-yil-temizligi';
    EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
      v_cron := false;
    END;
  END IF;

  RETURN jsonb_build_object(
    'kritik_rls', coalesce(v_rls, false),
    'public_yetki_yok', coalesce(v_public_yetki_yok, false),
    'kvkk_cron_aktif', coalesce(v_cron, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.guvenlik_yapilandirmasi_dogrula() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guvenlik_yapilandirmasi_dogrula() TO service_role;
