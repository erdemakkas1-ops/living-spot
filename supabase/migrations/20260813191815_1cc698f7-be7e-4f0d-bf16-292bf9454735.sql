ALTER TABLE public.giris_denemeleri ADD COLUMN IF NOT EXISTS kaynak_ozeti text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.gorev_tamamla_atomik(
  p_gorev_id uuid,
  p_foto_yolu text,
  p_personel_notu text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_durum text;
BEGIN
  SELECT durum INTO v_durum FROM public.gorevler WHERE id = p_gorev_id FOR UPDATE;
  IF v_durum IS NULL THEN
    RAISE EXCEPTION 'Görev bulunamadı.';
  END IF;
  IF v_durum = 'tamamlandi' THEN
    RAISE EXCEPTION 'Görev zaten tamamlanmış.';
  END IF;

  INSERT INTO public.is_loglari (gorev_id, foto_url, personel_notu)
  VALUES (p_gorev_id, p_foto_yolu, p_personel_notu);

  UPDATE public.gorevler SET durum = 'tamamlandi' WHERE id = p_gorev_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gorev_tamamla_atomik(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gorev_tamamla_atomik(uuid, text, text) TO service_role;