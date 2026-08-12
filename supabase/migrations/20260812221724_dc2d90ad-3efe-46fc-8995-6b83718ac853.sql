CREATE TABLE public.audit_loglari (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  yonetici_id uuid REFERENCES public.personel(id) ON DELETE SET NULL,
  islem_turu text NOT NULL,
  hedef_personel_id uuid,
  aciklama text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.audit_loglari TO service_role;

ALTER TABLE public.audit_loglari ENABLE ROW LEVEL SECURITY;

CREATE INDEX audit_loglari_created_at_idx ON public.audit_loglari (created_at DESC);