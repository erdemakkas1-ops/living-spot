ALTER TABLE public.personel
  ADD COLUMN IF NOT EXISTS mesai_durumu text NOT NULL DEFAULT 'calisiyor',
  ADD COLUMN IF NOT EXISTS durum_guncelleme timestamp with time zone NOT NULL DEFAULT now();