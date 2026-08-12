ALTER TABLE public.personel ADD COLUMN IF NOT EXISTS pin_hash text;
ALTER TABLE public.personel ALTER COLUMN pin_kodu DROP NOT NULL;