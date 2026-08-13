CREATE TABLE public.bloklar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blok_adi text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.personel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_soyad text NOT NULL,
  rol text NOT NULL DEFAULT 'personel' CHECK (rol IN ('ik','personel')),
  telefon text NOT NULL UNIQUE,
  pin_kodu text NOT NULL,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.gorevler (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blok_id uuid NOT NULL REFERENCES public.bloklar(id) ON DELETE CASCADE,
  personel_id uuid REFERENCES public.personel(id) ON DELETE SET NULL,
  is_basligi text NOT NULL,
  aciklama text,
  durum text NOT NULL DEFAULT 'bekliyor' CHECK (durum IN ('bekliyor','devam_ediyor','tamamlandi')),
  aciliyet text NOT NULL DEFAULT 'normal' CHECK (aciliyet IN ('normal','acil')),
  olusturma_tarihi timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.is_loglari (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gorev_id uuid NOT NULL REFERENCES public.gorevler(id) ON DELETE CASCADE,
  foto_url text,
  personel_notu text,
  tamamlanma_tarihi timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gorevler_blok ON public.gorevler(blok_id);
CREATE INDEX idx_gorevler_personel ON public.gorevler(personel_id);
CREATE INDEX idx_loglari_gorev ON public.is_loglari(gorev_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bloklar TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personel TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gorevler TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.is_loglari TO anon, authenticated;
GRANT ALL ON public.bloklar TO service_role;
GRANT ALL ON public.personel TO service_role;
GRANT ALL ON public.gorevler TO service_role;
GRANT ALL ON public.is_loglari TO service_role;

ALTER TABLE public.bloklar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gorevler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.is_loglari ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bloklar_all" ON public.bloklar FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "personel_all" ON public.personel FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "gorevler_all" ON public.gorevler FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "is_loglari_all" ON public.is_loglari FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.bloklar (blok_adi)
SELECT h.harf || n.sayi::text
FROM (VALUES ('A'),('B'),('C'),('D'),('E')) AS h(harf)
CROSS JOIN generate_series(1,10) AS n(sayi);

INSERT INTO public.bloklar (blok_adi) VALUES
  ('Sosyal Tesis'),('Kapalı Havuz'),('Otopark Blok'),('Güvenlik Kulesi'),('Peyzaj Alanı');

-- Üretim migration'ları demo kullanıcı, telefon, PIN veya örnek görev oluşturmaz.
-- İlk yönetici hesabı güvenli kurulum akışıyla ayrıca oluşturulmalıdır.
