ALTER TABLE public.is_loglari ADD COLUMN IF NOT EXISTS istemci_islem_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS is_loglari_istemci_islem_id_uidx ON public.is_loglari (istemci_islem_id) WHERE istemci_islem_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.gorev_tamamla_atomik(p_gorev_id uuid,p_foto_yolu text,p_personel_notu text,p_personel_id uuid,p_istemci_islem_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_durum text; v_atanan uuid;
BEGIN
 IF EXISTS(SELECT 1 FROM public.is_loglari WHERE istemci_islem_id=p_istemci_islem_id) THEN RETURN; END IF;
 SELECT durum,personel_id INTO v_durum,v_atanan FROM public.gorevler WHERE id=p_gorev_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Görev bulunamadı.'; END IF;
 IF v_atanan IS DISTINCT FROM p_personel_id THEN RAISE EXCEPTION 'Bu görev için yetkiniz yok.'; END IF;
 IF v_durum='tamamlandi' THEN RAISE EXCEPTION 'Görev zaten tamamlanmış.'; END IF;
 IF p_foto_yolu IS NULL OR p_foto_yolu NOT LIKE p_gorev_id::text||'/%' THEN RAISE EXCEPTION 'Fotoğraf bu göreve ait değil.'; END IF;
 INSERT INTO public.is_loglari(gorev_id,foto_url,personel_notu,istemci_islem_id) VALUES(p_gorev_id,p_foto_yolu,left(coalesce(p_personel_notu,''),2000),p_istemci_islem_id);
 UPDATE public.gorevler SET durum='tamamlandi' WHERE id=p_gorev_id;
 INSERT INTO public.audit_loglari(yonetici_id,islem_turu,hedef_personel_id,aciklama) VALUES(p_personel_id,'gorev_tamamla',p_personel_id,'Görev fotoğrafla tamamlandı: '||p_gorev_id::text);
END; $$;
REVOKE ALL ON FUNCTION public.gorev_tamamla_atomik(uuid,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gorev_tamamla_atomik(uuid,text,text,uuid,uuid) TO service_role;
