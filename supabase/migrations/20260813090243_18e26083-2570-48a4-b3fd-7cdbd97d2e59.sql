-- PIN değişikliğinde mevcut oturumların sunucu tarafında iptal edilebilmesi için
-- her personel kaydına monoton artan bir oturum sürümü eklenir.
ALTER TABLE public.personel
  ADD COLUMN IF NOT EXISTS oturum_surumu integer NOT NULL DEFAULT 1;

ALTER TABLE public.personel
  DROP CONSTRAINT IF EXISTS personel_oturum_surumu_pozitif;

ALTER TABLE public.personel
  ADD CONSTRAINT personel_oturum_surumu_pozitif CHECK (oturum_surumu >= 1);