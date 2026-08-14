-- KVKK veri minimizasyonu: fotoğraflar 180 gün, tamamlanmış görevler ve
-- denetim kayıtları 2 yıl saklanır. Aktif görevler bu temizlikten etkilenmez.
CREATE TABLE IF NOT EXISTS public.sistem_bakim_durumu (
  anahtar text PRIMARY KEY,
  son_calisma timestamptz NOT NULL DEFAULT to_timestamp(0)
);
REVOKE ALL ON public.sistem_bakim_durumu FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sistem_bakim_durumu TO service_role;

CREATE OR REPLACE FUNCTION public.veri_saklama_bakimi_baslat()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_alindi boolean := false;
BEGIN
  INSERT INTO public.sistem_bakim_durumu (anahtar)
  VALUES ('kvkk-gunluk-temizlik') ON CONFLICT DO NOTHING;

  UPDATE public.sistem_bakim_durumu
     SET son_calisma = now()
   WHERE anahtar = 'kvkk-gunluk-temizlik'
     AND son_calisma < now() - interval '23 hours';
  v_alindi := FOUND;
  RETURN v_alindi;
END;
$$;

-- Değiştirilemez audit kayıtları yalnız bu kısıtlı saklama prosedürü içinde
-- ve yalnız süresi dolmuş kayıtlar için silinebilir.
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

CREATE OR REPLACE FUNCTION public.veri_saklama_kayitlarini_temizle(p_log_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.is_loglari
   WHERE id = ANY(coalesce(p_log_ids, ARRAY[]::uuid[]))
     AND tamamlanma_tarihi < now() - interval '180 days';

  -- Yalnız tamamlanmış ve iki yıldan eski görevler kaldırılır.
  DELETE FROM public.gorevler
   WHERE durum = 'tamamlandi'
     AND olusturma_tarihi < now() - interval '730 days'
     AND NOT EXISTS (
       SELECT 1 FROM public.is_loglari l WHERE l.gorev_id = gorevler.id
     );

  PERFORM set_config('app.kvkk_retention_cleanup', 'on', true);
  DELETE FROM public.audit_loglari
   WHERE created_at < now() - interval '730 days';
END;
$$;

REVOKE ALL ON FUNCTION public.veri_saklama_bakimi_baslat() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.veri_saklama_kayitlarini_temizle(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.veri_saklama_bakimi_baslat() TO service_role;
GRANT EXECUTE ON FUNCTION public.veri_saklama_kayitlarini_temizle(uuid[]) TO service_role;

-- Denetim kayıtlarının iki yıllık temizliği yönetici girişinden bağımsız da çalışır.
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'audit-loglari-2-yil-temizligi',
  '37 3 * * *',
  $$SELECT public.veri_saklama_kayitlarini_temizle(ARRAY[]::uuid[])$$
);