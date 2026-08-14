ALTER TABLE public.personel_metin_onaylari
  ADD COLUMN IF NOT EXISTS belge_ozeti text,
  ADD COLUMN IF NOT EXISTS hukuki_sebep text NOT NULL DEFAULT 'kvkk_m5_2_sozlesme_hukuki_yukumluluk_mesru_menfaat',
  ADD COLUMN IF NOT EXISTS onceki_riza_geri_cekildi boolean NOT NULL DEFAULT false;

-- Eski sürüm kayıtları tarihsel delil olarak korunur. Yeni sürüm ancak içerik özetiyle geçerlidir.
UPDATE public.personel_metin_onaylari
SET belge_ozeti = 'legacy-surum-ozeti-yok'
WHERE belge_ozeti IS NULL;

ALTER TABLE public.personel_metin_onaylari
  ALTER COLUMN belge_ozeti SET NOT NULL;

ALTER TABLE public.personel_metin_onaylari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personel_metin_onaylari FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.personel_metin_onaylari FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.personel_metin_onaylari TO service_role;
