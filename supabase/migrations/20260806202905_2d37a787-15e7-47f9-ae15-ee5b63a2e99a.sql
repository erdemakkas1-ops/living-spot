ALTER TABLE public.gorevler
  ADD COLUMN IF NOT EXISTS is_turu text NOT NULL DEFAULT 'genel'
  CHECK (is_turu IN ('peyzaj','bakim','temizlik','guvenlik','elektrik','sihhi_tesisat','tadilat','genel'));

UPDATE public.gorevler SET is_turu = 'bakim' WHERE is_basligi = 'Asansör arıza kontrolü';
UPDATE public.gorevler SET is_turu = 'elektrik' WHERE is_basligi = 'Merdiven boşluğu ampul değişimi';
UPDATE public.gorevler SET is_turu = 'sihhi_tesisat' WHERE is_basligi = 'Su sızıntısı onarımı';
UPDATE public.gorevler SET is_turu = 'bakim' WHERE is_basligi = 'Kapı otomatiği ayarı';
UPDATE public.gorevler SET is_turu = 'temizlik' WHERE is_basligi = 'Havuz filtre temizliği';
UPDATE public.gorevler SET is_turu = 'peyzaj' WHERE is_basligi = 'Çim biçme ve sulama kontrolü';