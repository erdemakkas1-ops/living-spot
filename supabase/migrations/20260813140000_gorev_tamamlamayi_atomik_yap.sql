-- İş logu ekleme ve görev durumunu güncelleme tek transaction içinde çalışır.
CREATE OR REPLACE FUNCTION public.gorev_tamamla_atomik(
  p_gorev_id uuid,
  p_foto_yolu text,
  p_personel_notu text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_durum text;
BEGIN
  SELECT durum INTO v_durum
  FROM public.gorevler
  WHERE id = p_gorev_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Görev bulunamadı.';
  END IF;
  IF v_durum = 'tamamlandi' THEN
    RAISE EXCEPTION 'Görev zaten tamamlanmış.';
  END IF;
  IF p_foto_yolu IS NULL OR p_foto_yolu NOT LIKE p_gorev_id::text || '/%' THEN
    RAISE EXCEPTION 'Fotoğraf bu göreve ait değil.';
  END IF;

  INSERT INTO public.is_loglari (gorev_id, foto_url, personel_notu)
  VALUES (p_gorev_id, p_foto_yolu, left(coalesce(p_personel_notu, ''), 2000));

  UPDATE public.gorevler SET durum = 'tamamlandi' WHERE id = p_gorev_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gorev_tamamla_atomik(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gorev_tamamla_atomik(uuid, text, text) TO service_role;
