-- Önceki örnek İK adını kalıcı yönetici adıyla değiştirir.
UPDATE public.personel
SET ad_soyad = 'Elvan Hanım'
WHERE rol = 'ik' OR ad_soyad = 'Selin Yıldırım';
