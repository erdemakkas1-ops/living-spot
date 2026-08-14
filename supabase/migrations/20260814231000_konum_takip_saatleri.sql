-- Personel konum takibi yalnız yöneticinin belirlediği çalışma saatlerinde aktiftir.
CREATE TABLE IF NOT EXISTS public.personel_konum_takip_saatleri (
  personel_id uuid PRIMARY KEY REFERENCES public.personel(id) ON DELETE CASCADE,
  ise_baslangic time NOT NULL,
  is_bitisi time NOT NULL,
  ek_calisma_bitisi time,
  takip_aktif boolean NOT NULL DEFAULT true,
  guncellendi_at timestamptz NOT NULL DEFAULT now(),
  guncelleyen_id uuid REFERENCES public.personel(id) ON DELETE SET NULL,
  CONSTRAINT konum_saatleri_farkli CHECK (ise_baslangic <> is_bitisi),
  CONSTRAINT ek_calisma_farkli CHECK (ek_calisma_bitisi IS NULL OR ek_calisma_bitisi <> ise_baslangic)
);

ALTER TABLE public.personel_konum_takip_saatleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personel_konum_takip_saatleri FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.personel_konum_takip_saatleri FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.personel_konum_takip_saatleri TO service_role;

CREATE OR REPLACE FUNCTION public.konum_takip_saati_guncelle(
  p_yonetici_id uuid, p_personel_id uuid, p_ise_baslangic time,
  p_is_bitisi time, p_ek_calisma_bitisi time, p_takip_aktif boolean
)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.personel WHERE id = p_yonetici_id AND rol = 'ik' AND aktif) THEN
    RAISE EXCEPTION 'Yönetim yetkisi gerekiyor.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.personel WHERE id = p_personel_id AND rol = 'personel') THEN
    RAISE EXCEPTION 'Personel bulunamadı.';
  END IF;
  INSERT INTO public.personel_konum_takip_saatleri
    (personel_id, ise_baslangic, is_bitisi, ek_calisma_bitisi, takip_aktif, guncellendi_at, guncelleyen_id)
  VALUES (p_personel_id, p_ise_baslangic, p_is_bitisi, p_ek_calisma_bitisi, p_takip_aktif, now(), p_yonetici_id)
  ON CONFLICT (personel_id) DO UPDATE SET
    ise_baslangic=EXCLUDED.ise_baslangic, is_bitisi=EXCLUDED.is_bitisi,
    ek_calisma_bitisi=EXCLUDED.ek_calisma_bitisi, takip_aktif=EXCLUDED.takip_aktif,
    guncellendi_at=now(), guncelleyen_id=EXCLUDED.guncelleyen_id;
  INSERT INTO public.audit_loglari (yonetici_id, islem_turu, hedef_personel_id, aciklama)
  VALUES (p_yonetici_id, 'konum_takip_saati', p_personel_id,
    CASE WHEN p_takip_aktif THEN 'Konum takip saatleri güncellendi.' ELSE 'Konum takibi kapatıldı.' END);
END;
$$;
REVOKE ALL ON FUNCTION public.konum_takip_saati_guncelle(uuid, uuid, time, time, time, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.konum_takip_saati_guncelle(uuid, uuid, time, time, time, boolean)
  TO service_role;
