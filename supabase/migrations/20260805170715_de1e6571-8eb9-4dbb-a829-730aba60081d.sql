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

INSERT INTO public.personel (ad_soyad, rol, telefon, pin_kodu) VALUES
  ('Selin Yıldırım', 'ik', '05001112233', '1234'),
  ('Ahmet Kara', 'personel', '05310000001', '1111'),
  ('Mehmet Demir', 'personel', '05310000002', '1112'),
  ('Hasan Çelik', 'personel', '05310000003', '1113'),
  ('Mustafa Şahin', 'personel', '05310000004', '1114'),
  ('İbrahim Yılmaz', 'personel', '05310000005', '1115'),
  ('Ali Koç', 'personel', '05310000006', '1116'),
  ('Osman Arslan', 'personel', '05310000007', '1117'),
  ('Emre Doğan', 'personel', '05310000008', '1118'),
  ('Kemal Aydın', 'personel', '05310000009', '1119'),
  ('Serkan Öztürk', 'personel', '05310000010', '1120'),
  ('Murat Kaya', 'personel', '05310000011', '1121'),
  ('Fatih Aksoy', 'personel', '05310000012', '1122'),
  ('Recep Bulut', 'personel', '05310000013', '1123'),
  ('Yusuf Erdem', 'personel', '05310000014', '1124'),
  ('Halil Turan', 'personel', '05310000015', '1125'),
  ('Ramazan Polat', 'personel', '05310000016', '1126'),
  ('Bilal Güneş', 'personel', '05310000017', '1127'),
  ('Cengiz Ateş', 'personel', '05310000018', '1128'),
  ('Tolga Kurt', 'personel', '05310000019', '1129'),
  ('Metin Sarı', 'personel', '05310000020', '1130');

INSERT INTO public.gorevler (blok_id, personel_id, is_basligi, aciklama, durum, aciliyet)
VALUES
  ((SELECT id FROM public.bloklar WHERE blok_adi='A1'), (SELECT id FROM public.personel WHERE telefon='05310000001'), 'Asansör arıza kontrolü', 'A1 blok 2. asansör kat sensörü hatalı, kontrol edilecek.', 'bekliyor', 'acil'),
  ((SELECT id FROM public.bloklar WHERE blok_adi='B5'), (SELECT id FROM public.personel WHERE telefon='05310000001'), 'Merdiven boşluğu ampul değişimi', '3. ve 5. kat aydınlatmaları yanmıyor.', 'devam_ediyor', 'normal'),
  ((SELECT id FROM public.bloklar WHERE blok_adi='B5'), (SELECT id FROM public.personel WHERE telefon='05310000002'), 'Su sızıntısı onarımı', 'Bodrum kat kolon hattında sızıntı var.', 'bekliyor', 'acil'),
  ((SELECT id FROM public.bloklar WHERE blok_adi='C3'), (SELECT id FROM public.personel WHERE telefon='05310000003'), 'Kapı otomatiği ayarı', 'Ana giriş kapısı yavaş kapanıyor.', 'tamamlandi', 'normal'),
  ((SELECT id FROM public.bloklar WHERE blok_adi='Sosyal Tesis'), (SELECT id FROM public.personel WHERE telefon='05310000004'), 'Havuz filtre temizliği', 'Haftalık rutin filtre bakımı.', 'bekliyor', 'normal'),
  ((SELECT id FROM public.bloklar WHERE blok_adi='Peyzaj Alanı'), (SELECT id FROM public.personel WHERE telefon='05310000005'), 'Çim biçme ve sulama kontrolü', 'Doğu bahçe hattı damlama sistemi kontrolü.', 'devam_ediyor', 'normal');

INSERT INTO public.is_loglari (gorev_id, personel_notu, foto_url)
VALUES ((SELECT id FROM public.gorevler WHERE is_basligi='Kapı otomatiği ayarı'), 'Hidrolik ayarı yapıldı, kapı normal hızda kapanıyor.', NULL);