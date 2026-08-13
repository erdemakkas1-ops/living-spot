ALTER TABLE public.personel
  ADD COLUMN IF NOT EXISTS mfa_secret_enc text,
  ADD COLUMN IF NOT EXISTS mfa_aktif boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.personel.mfa_secret_enc IS
  'Sunucu tarafında AES-GCM ile şifrelenmiş TOTP anahtarı; istemciye yalnız ilk kurulumda gösterilir.';
