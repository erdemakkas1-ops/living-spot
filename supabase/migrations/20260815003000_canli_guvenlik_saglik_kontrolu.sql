CREATE OR REPLACE FUNCTION public.guvenlik_yapilandirmasi_dogrula()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rls boolean;
  v_public_yetki_yok boolean;
  v_cron boolean;
BEGIN
  SELECT count(*) = 9 AND bool_and(c.relrowsecurity AND c.relforcerowsecurity)
    INTO v_rls
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = ANY (ARRAY[
      'personel','gorevler','is_loglari','audit_loglari','personel_konumlari',
      'konum_izinleri','personel_konum_takip_saatleri','sistem_bakim_durumu','personel_bildirimleri'
    ]);

  SELECT NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = ANY (ARRAY[
        'personel','gorevler','is_loglari','audit_loglari','personel_konumlari',
        'konum_izinleri','personel_konum_takip_saatleri','sistem_bakim_durumu','personel_bildirimleri'
      ])
      AND (
        pg_catalog.has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
        OR pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
      )
  ) INTO v_public_yetki_yok;

  SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_cron')
    AND EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kvkk-gunluk-temizlik' AND active)
    INTO v_cron;

  RETURN jsonb_build_object(
    'kritik_rls', coalesce(v_rls, false),
    'public_yetki_yok', coalesce(v_public_yetki_yok, false),
    'kvkk_cron_aktif', coalesce(v_cron, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.guvenlik_yapilandirmasi_dogrula() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guvenlik_yapilandirmasi_dogrula() TO service_role;
