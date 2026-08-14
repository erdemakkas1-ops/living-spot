-- Personel yönetimi ile denetim kaydını aynı transaction içinde gerçekleştirir.
CREATE OR REPLACE FUNCTION public.personel_yonet_atomik(
  p_islem text,
  p_yonetici_id uuid,
  p_hedef_id uuid,
  p_veri jsonb,
  p_audit_aciklama text,
  p_pin_degisti boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_hedef_id uuid := p_hedef_id;
BEGIN
  IF p_islem = 'ekle' THEN
    INSERT INTO public.personel
      (ad_soyad, telefon, pin_kodu, pin_hash, rol, aktif)
    VALUES
      (p_veri->>'ad_soyad', p_veri->>'telefon', NULL, p_veri->>'pin_hash', 'personel', true)
    RETURNING id INTO v_hedef_id;
  ELSIF p_islem = 'aktiflik' THEN
    UPDATE public.personel
       SET aktif = (p_veri->>'aktif')::boolean
     WHERE id = p_hedef_id AND rol = 'personel';
    IF NOT FOUND THEN RAISE EXCEPTION 'Personel kaydı bulunamadı.'; END IF;
  ELSIF p_islem = 'duzenle' THEN
    UPDATE public.personel
       SET ad_soyad = p_veri->>'ad_soyad',
           telefon = p_veri->>'telefon',
           aktif = (p_veri->>'aktif')::boolean,
           pin_kodu = CASE WHEN p_pin_degisti THEN NULL ELSE pin_kodu END,
           pin_hash = CASE WHEN p_pin_degisti THEN p_veri->>'pin_hash' ELSE pin_hash END,
           oturum_surumu = CASE WHEN p_pin_degisti THEN oturum_surumu + 1 ELSE oturum_surumu END
     WHERE id = p_hedef_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Personel kaydı bulunamadı.'; END IF;
  ELSIF p_islem = 'sil' THEN
    UPDATE public.gorevler SET personel_id = NULL WHERE personel_id = p_hedef_id;
    DELETE FROM public.personel_konumlari WHERE personel_id = p_hedef_id;
    DELETE FROM public.personel WHERE id = p_hedef_id AND rol = 'personel';
    IF NOT FOUND THEN RAISE EXCEPTION 'Personel kaydı bulunamadı.'; END IF;
  ELSE
    RAISE EXCEPTION 'Geçersiz personel yönetimi işlemi.';
  END IF;

  INSERT INTO public.audit_loglari
    (yonetici_id, islem_turu, hedef_personel_id, aciklama)
  VALUES
    (p_yonetici_id,
     CASE p_islem
       WHEN 'ekle' THEN 'personel_ekle'
       WHEN 'aktiflik' THEN 'personel_aktiflik'
       WHEN 'duzenle' THEN 'personel_duzenle'
       WHEN 'sil' THEN 'personel_sil'
     END,
     v_hedef_id,
     left(coalesce(p_audit_aciklama, ''), 500));

  IF p_islem = 'duzenle' AND p_pin_degisti THEN
    INSERT INTO public.audit_loglari
      (yonetici_id, islem_turu, hedef_personel_id, aciklama)
    VALUES
      (p_yonetici_id, 'personel_pin_degistir', v_hedef_id,
       'Personel PIN kodu yönetici tarafından yenilendi.');
  END IF;

  RETURN v_hedef_id;
END;
$$;

REVOKE ALL ON FUNCTION public.personel_yonet_atomik(text, uuid, uuid, jsonb, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.personel_yonet_atomik(text, uuid, uuid, jsonb, text, boolean)
  TO service_role;