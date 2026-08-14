CREATE OR REPLACE FUNCTION public.konum_izni_guncelle(
  p_personel_id uuid,
  p_izin_verildi boolean,
  p_metin_surumu text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.konum_izinleri (
    personel_id, izin_verildi, metin_surumu, verildi_at,
    geri_cekildi_at, guncellendi_at
  ) VALUES (
    p_personel_id, p_izin_verildi, p_metin_surumu,
    CASE WHEN p_izin_verildi THEN now() ELSE NULL END,
    CASE WHEN p_izin_verildi THEN NULL ELSE now() END,
    now()
  )
  ON CONFLICT (personel_id) DO UPDATE SET
    izin_verildi = EXCLUDED.izin_verildi,
    metin_surumu = EXCLUDED.metin_surumu,
    verildi_at = CASE
      WHEN EXCLUDED.izin_verildi THEN now()
      ELSE konum_izinleri.verildi_at
    END,
    geri_cekildi_at = CASE WHEN EXCLUDED.izin_verildi THEN NULL ELSE now() END,
    guncellendi_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.konum_izni_guncelle(uuid, boolean, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.konum_izni_guncelle(uuid, boolean, text)
  TO service_role;
