-- is-fotolari yalnız service_role + imzalı URL mimarisiyle kullanılır.
-- Politika bulunmaması zaten varsayılan red davranışıdır; aşağıdaki RESTRICTIVE
-- politikalar ileride yanlışlıkla permissive bir politika eklense bile public rolleri engeller.
DROP POLICY IF EXISTS "is_fotolari_anon_acik_reddet" ON storage.objects;
DROP POLICY IF EXISTS "is_fotolari_authenticated_acik_reddet" ON storage.objects;

CREATE POLICY "is_fotolari_anon_acik_reddet"
ON storage.objects AS RESTRICTIVE FOR ALL TO anon
USING (bucket_id <> 'is-fotolari')
WITH CHECK (bucket_id <> 'is-fotolari');

CREATE POLICY "is_fotolari_authenticated_acik_reddet"
ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
USING (bucket_id <> 'is-fotolari')
WITH CHECK (bucket_id <> 'is-fotolari');

CREATE OR REPLACE FUNCTION public.guvenlik_yapilandirmasi_dogrula()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,storage AS $$
DECLARE v_rls boolean; v_public boolean; v_cron boolean; v_bucket boolean; v_storage_policy boolean;
 v_rpc boolean; v_audit_trigger boolean; v_bildirim_cron boolean;
 v_tablolar text[]:=ARRAY['bloklar','personel','gorevler','is_loglari','audit_loglari','personel_konumlari','konum_izinleri','personel_konum_takip_saatleri','sistem_bakim_durumu','personel_bildirimleri','giris_denemeleri','personel_metin_onaylari','api_hiz_sinirlari'];
BEGIN
 SELECT count(*)=cardinality(v_tablolar) AND bool_and(c.relrowsecurity AND c.relforcerowsecurity) INTO v_rls
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(v_tablolar);
 SELECT NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname=ANY(v_tablolar) AND
  (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'))) INTO v_public;
 SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id='is-fotolari' AND public=false) INTO v_bucket;
 SELECT
  NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND permissive='PERMISSIVE'
    AND (roles @> ARRAY['anon']::name[] OR roles @> ARRAY['authenticated']::name[])
    AND (coalesce(qual,'') LIKE '%is-fotolari%' OR coalesce(with_check,'') LIKE '%is-fotolari%'))
  AND EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='is_fotolari_anon_acik_reddet' AND permissive='RESTRICTIVE')
  AND EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='is_fotolari_authenticated_acik_reddet' AND permissive='RESTRICTIVE')
 INTO v_storage_policy;
 SELECT NOT EXISTS(SELECT 1 FROM information_schema.routine_privileges WHERE specific_schema='public'
  AND grantee IN ('PUBLIC','anon','authenticated') AND routine_name IN
  ('giris_denemesi_rezerve_et','api_hiz_hakki_kullan','gorev_olustur_atomik','gorev_baslat_atomik','gorev_tamamla_atomik')) INTO v_rpc;
 SELECT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='audit_loglari'
    AND t.tgname='audit_loglari_degistirilemez' AND NOT t.tgisinternal) INTO v_audit_trigger;
 IF to_regclass('cron.job') IS NOT NULL THEN
  BEGIN
   EXECUTE 'SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname=$1 AND active)' INTO v_cron USING 'audit-loglari-2-yil-temizligi';
   EXECUTE 'SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname=$1 AND active)' INTO v_bildirim_cron USING 'personel-bildirimleri-180-gun-temizligi';
  EXCEPTION WHEN OTHERS THEN v_cron:=false; v_bildirim_cron:=false; END;
 ELSE v_cron:=false; v_bildirim_cron:=false; END IF;
 RETURN jsonb_build_object('kritik_rls',coalesce(v_rls,false),'public_yetki_yok',coalesce(v_public,false),
  'kvkk_cron_aktif',coalesce(v_cron,false),'foto_bucket_ozel',coalesce(v_bucket,false),
  'storage_public_policy_yok',coalesce(v_storage_policy,false),'rpc_public_yok',coalesce(v_rpc,false),
  'audit_degistirilemez',coalesce(v_audit_trigger,false),'bildirim_cron_aktif',coalesce(v_bildirim_cron,false));
END; $$;
REVOKE ALL ON FUNCTION public.guvenlik_yapilandirmasi_dogrula() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guvenlik_yapilandirmasi_dogrula() TO service_role;
