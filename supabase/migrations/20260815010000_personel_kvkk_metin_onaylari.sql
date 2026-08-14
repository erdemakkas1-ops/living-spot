CREATE TABLE IF NOT EXISTS public.personel_metin_onaylari (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personel_id uuid NOT NULL REFERENCES public.personel(id) ON DELETE CASCADE,
  metin_turu text NOT NULL CHECK (metin_turu IN ('kvkk_aydinlatma')),
  metin_surumu text NOT NULL,
  belge_ozeti text NOT NULL,
  hukuki_sebep text NOT NULL DEFAULT 'kvkk_m5_2_sozlesme_hukuki_yukumluluk_mesru_menfaat',
  onceki_riza_geri_cekildi boolean NOT NULL DEFAULT false,
  okundu_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (personel_id, metin_turu, metin_surumu)
);

CREATE INDEX IF NOT EXISTS personel_metin_onaylari_personel_idx
  ON public.personel_metin_onaylari (personel_id, okundu_at DESC);

ALTER TABLE public.personel_metin_onaylari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personel_metin_onaylari FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.personel_metin_onaylari FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.personel_metin_onaylari TO service_role;

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
    'personel_bildirimleri','giris_denemeleri','personel_metin_onaylari'
  ];
BEGIN
  SELECT count(*) = cardinality(v_tablolar)
         AND bool_and(c.relrowsecurity AND c.relforcerowsecurity)
    INTO v_rls
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = ANY (v_tablolar);

  SELECT NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY (v_tablolar)
      AND (pg_catalog.has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
        OR pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE'))
  ) INTO v_public_yetki_yok;

  IF pg_catalog.to_regclass('cron.job') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = $1 AND active)'
        INTO v_cron USING 'audit-loglari-2-yil-temizligi';
    EXCEPTION WHEN insufficient_privilege OR undefined_table THEN v_cron := false;
    END;
  END IF;

  RETURN jsonb_build_object('kritik_rls', coalesce(v_rls, false),
    'public_yetki_yok', coalesce(v_public_yetki_yok, false),
    'kvkk_cron_aktif', coalesce(v_cron, false));
END;
$$;

REVOKE ALL ON FUNCTION public.guvenlik_yapilandirmasi_dogrula() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guvenlik_yapilandirmasi_dogrula() TO service_role;
