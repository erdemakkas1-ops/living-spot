CREATE TABLE IF NOT EXISTS public.personel_bildirimleri (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personel_id uuid NOT NULL REFERENCES public.personel(id) ON DELETE CASCADE,
  tur text NOT NULL CHECK (tur IN ('fazla_mesai', 'konum_bilgilendirme')),
  baslik text NOT NULL CHECK (char_length(baslik) BETWEEN 1 AND 120),
  mesaj text NOT NULL CHECK (char_length(mesaj) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  okundu_at timestamptz
);
CREATE INDEX IF NOT EXISTS personel_bildirimleri_personel_tarih_idx
  ON public.personel_bildirimleri (personel_id, created_at DESC);
ALTER TABLE public.personel_bildirimleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personel_bildirimleri FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.personel_bildirimleri FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.personel_bildirimleri TO service_role;

CREATE OR REPLACE FUNCTION public.konum_takip_saati_guncelle(
  p_yonetici_id uuid, p_personel_id uuid, p_ise_baslangic time,
  p_is_bitisi time, p_ek_calisma_bitisi time, p_takip_aktif boolean
)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE onceki_ek time;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.personel WHERE id = p_yonetici_id AND rol = 'ik' AND aktif) THEN
    RAISE EXCEPTION 'Yönetim yetkisi gerekiyor.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.personel WHERE id = p_personel_id AND rol = 'personel') THEN
    RAISE EXCEPTION 'Personel bulunamadı.';
  END IF;
  SELECT ek_calisma_bitisi INTO onceki_ek FROM public.personel_konum_takip_saatleri WHERE personel_id=p_personel_id;
  INSERT INTO public.personel_konum_takip_saatleri
    (personel_id, ise_baslangic, is_bitisi, ek_calisma_bitisi, takip_aktif, guncellendi_at, guncelleyen_id)
  VALUES (p_personel_id, p_ise_baslangic, p_is_bitisi, p_ek_calisma_bitisi, p_takip_aktif, now(), p_yonetici_id)
  ON CONFLICT (personel_id) DO UPDATE SET
    ise_baslangic=EXCLUDED.ise_baslangic, is_bitisi=EXCLUDED.is_bitisi,
    ek_calisma_bitisi=EXCLUDED.ek_calisma_bitisi, takip_aktif=EXCLUDED.takip_aktif,
    guncellendi_at=now(), guncelleyen_id=EXCLUDED.guncelleyen_id;
  IF p_ek_calisma_bitisi IS NOT NULL AND p_ek_calisma_bitisi IS DISTINCT FROM onceki_ek THEN
    INSERT INTO public.personel_bildirimleri(personel_id,tur,baslik,mesaj)
    VALUES (p_personel_id,'fazla_mesai','Ek çalışma saati tanımlandı',
      'Çalışma süreniz '||to_char(p_ek_calisma_bitisi,'HH24:MI')||' saatine kadar uzatıldı. Konum takibi yalnız '||to_char(p_ise_baslangic,'HH24:MI')||'–'||to_char(p_ek_calisma_bitisi,'HH24:MI')||' arasında aktif olabilir; bu saatlerin dışında kapalıdır.');
  END IF;
  INSERT INTO public.audit_loglari (yonetici_id, islem_turu, hedef_personel_id, aciklama)
  VALUES (p_yonetici_id, 'konum_takip_saati', p_personel_id,
    CASE WHEN p_takip_aktif THEN 'Konum takip saatleri güncellendi.' ELSE 'Konum takibi kapatıldı.' END);
END;
$$;
REVOKE ALL ON FUNCTION public.konum_takip_saati_guncelle(uuid, uuid, time, time, time, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.konum_takip_saati_guncelle(uuid, uuid, time, time, time, boolean) TO service_role;
