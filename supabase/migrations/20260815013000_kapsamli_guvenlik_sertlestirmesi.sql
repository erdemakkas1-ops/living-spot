-- Eski, herkese izin veren politikaları kalıcı olarak kaldır.
DROP POLICY IF EXISTS "bloklar_all" ON public.bloklar;
DROP POLICY IF EXISTS "personel_all" ON public.personel;
DROP POLICY IF EXISTS "gorevler_all" ON public.gorevler;
DROP POLICY IF EXISTS "is_loglari_all" ON public.is_loglari;
DROP POLICY IF EXISTS "personel_konumlari_all" ON public.personel_konumlari;
DROP POLICY IF EXISTS "is_fotolari_read" ON storage.objects;
DROP POLICY IF EXISTS "is_fotolari_insert" ON storage.objects;
DROP POLICY IF EXISTS "is_fotolari_update" ON storage.objects;

-- Fotoğraflar yalnız service_role ve kısa ömürlü imzalı URL ile okunur.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('is-fotolari', 'is-fotolari', false, 8388608, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public=false, file_size_limit=8388608,
  allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'];

-- Yeni/bozuk koordinatların veri tabanına girmesini engelle; mevcut kayıt taraması ayrı yapılabilir.
ALTER TABLE public.personel_konumlari
  ADD CONSTRAINT personel_konumlari_enlem_chk CHECK (enlem BETWEEN -90 AND 90) NOT VALID,
  ADD CONSTRAINT personel_konumlari_boylam_chk CHECK (boylam BETWEEN -180 AND 180) NOT VALID,
  ADD CONSTRAINT personel_konumlari_dogruluk_chk CHECK (dogruluk IS NULL OR dogruluk BETWEEN 0 AND 100000) NOT VALID,
  ADD CONSTRAINT personel_konumlari_tarih_chk CHECK (kayit_tarihi <= now() + interval '5 minutes') NOT VALID;

-- Her giriş/MFA denemesini kilit altında rezerve ederek paralel istek aşımını kapatır.
CREATE OR REPLACE FUNCTION public.giris_denemesi_rezerve_et(
  p_kimlik text, p_kaynak text, p_kaynak_limit integer, p_hesap_limit integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog AS $$
DECLARE v_kaynak integer; v_hesap integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('giris:'||p_kimlik, 0));
  DELETE FROM public.giris_denemeleri WHERE deneme_tarihi < now()-interval '24 hours';
  SELECT count(*) INTO v_kaynak FROM public.giris_denemeleri
    WHERE telefon=p_kimlik AND kaynak_ozeti=p_kaynak AND deneme_tarihi>=now()-interval '15 minutes';
  SELECT count(*) INTO v_hesap FROM public.giris_denemeleri
    WHERE telefon=p_kimlik AND deneme_tarihi>=now()-interval '15 minutes';
  IF v_kaynak>=p_kaynak_limit OR v_hesap>=p_hesap_limit THEN
    RETURN jsonb_build_object('izinli',false,'kaynak',v_kaynak,'hesap',v_hesap);
  END IF;
  INSERT INTO public.giris_denemeleri(telefon,kaynak_ozeti) VALUES(p_kimlik,p_kaynak);
  RETURN jsonb_build_object('izinli',true,'kaynak',v_kaynak+1,'hesap',v_hesap+1);
END; $$;
REVOKE ALL ON FUNCTION public.giris_denemesi_rezerve_et(text,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.giris_denemesi_rezerve_et(text,text,integer,integer) TO service_role;

CREATE TABLE IF NOT EXISTS public.api_hiz_sinirlari(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  personel_id uuid NOT NULL REFERENCES public.personel(id) ON DELETE CASCADE,
  islem_turu text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_hiz_sinirlari_idx ON public.api_hiz_sinirlari(personel_id,islem_turu,created_at DESC);
ALTER TABLE public.api_hiz_sinirlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_hiz_sinirlari FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_hiz_sinirlari FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.api_hiz_sinirlari TO service_role;

CREATE OR REPLACE FUNCTION public.api_hiz_hakki_kullan(p_personel_id uuid,p_tur text,p_limit integer,p_pencere_saniye integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog AS $$
DECLARE v_adet integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('api:'||p_personel_id::text||':'||p_tur,0));
  DELETE FROM public.api_hiz_sinirlari WHERE created_at<now()-interval '24 hours';
  SELECT count(*) INTO v_adet FROM public.api_hiz_sinirlari WHERE personel_id=p_personel_id
    AND islem_turu=p_tur AND created_at>=now()-make_interval(secs=>p_pencere_saniye);
  IF v_adet>=p_limit THEN RETURN false; END IF;
  INSERT INTO public.api_hiz_sinirlari(personel_id,islem_turu) VALUES(p_personel_id,p_tur);
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.api_hiz_hakki_kullan(uuid,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.api_hiz_hakki_kullan(uuid,text,integer,integer) TO service_role;

ALTER TABLE public.personel ADD COLUMN IF NOT EXISTS mfa_son_sayac bigint;
ALTER TABLE public.personel ADD COLUMN IF NOT EXISTS mfa_aday_jti uuid;

ALTER TABLE public.personel_metin_onaylari
  DROP CONSTRAINT IF EXISTS personel_metin_onaylari_personel_id_metin_turu_metin_surumu_key;
CREATE UNIQUE INDEX IF NOT EXISTS personel_metin_onaylari_belge_uidx
  ON public.personel_metin_onaylari(personel_id,metin_turu,metin_surumu,belge_ozeti);

CREATE OR REPLACE FUNCTION public.gorev_olustur_atomik(p_yonetici_id uuid,p_personel_id uuid,p_blok_id uuid,p_is_basligi text,p_aciklama text,p_aciliyet text,p_is_turu text,p_planlanan_tarih date)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.personel WHERE id=p_personel_id AND rol='personel' AND aktif) THEN RAISE EXCEPTION 'Personel aktif değil.'; END IF;
 INSERT INTO public.gorevler(blok_id,personel_id,is_basligi,aciklama,aciliyet,is_turu,planlanan_tarih)
 VALUES(p_blok_id,p_personel_id,left(p_is_basligi,200),left(coalesce(p_aciklama,''),2000),p_aciliyet,p_is_turu,p_planlanan_tarih) RETURNING id INTO v_id;
 INSERT INTO public.audit_loglari(yonetici_id,hedef_personel_id,islem_turu,aciklama) VALUES(p_yonetici_id,p_personel_id,'gorev_olustur','Görev oluşturuldu: '||v_id);
 RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.gorev_olustur_atomik(uuid,uuid,uuid,text,text,text,text,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gorev_olustur_atomik(uuid,uuid,uuid,text,text,text,text,date) TO service_role;

CREATE OR REPLACE FUNCTION public.gorev_baslat_atomik(p_gorev_id uuid,p_personel_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_durum text; v_atanan uuid;
BEGIN
 SELECT durum,personel_id INTO v_durum,v_atanan FROM public.gorevler WHERE id=p_gorev_id FOR UPDATE;
 IF NOT FOUND OR v_atanan IS DISTINCT FROM p_personel_id THEN RAISE EXCEPTION 'Görev yetkisi yok.'; END IF;
 IF v_durum IN ('devam_ediyor','tamamlandi') THEN RETURN false; END IF;
 IF v_durum<>'bekliyor' THEN RAISE EXCEPTION 'Görev başlatılamaz.'; END IF;
 UPDATE public.gorevler SET durum='devam_ediyor' WHERE id=p_gorev_id;
 INSERT INTO public.audit_loglari(yonetici_id,hedef_personel_id,islem_turu,aciklama) VALUES(p_personel_id,p_personel_id,'gorev_baslat','Görev başlatıldı: '||p_gorev_id);
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.gorev_baslat_atomik(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gorev_baslat_atomik(uuid,uuid) TO service_role;

-- Bildirimler 180 günden uzun tutulmaz.
SELECT cron.schedule('personel-bildirimleri-180-gun-temizligi','17 4 * * *',
  $$DELETE FROM public.personel_bildirimleri WHERE created_at<now()-interval '180 days'$$);

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
 SELECT NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
  AND (roles @> ARRAY['anon']::name[] OR roles @> ARRAY['authenticated']::name[])
  AND (coalesce(qual,'') LIKE '%is-fotolari%' OR coalesce(with_check,'') LIKE '%is-fotolari%')) INTO v_storage_policy;
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
