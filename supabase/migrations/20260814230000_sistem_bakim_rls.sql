-- Bakım çalışma durumu yalnız güvenilir sunucu kodu tarafından kullanılabilir.
-- PostgREST üzerinden anon/authenticated erişimini iki katmanlı olarak kapat:
-- tablo yetkilerini kaldır ve RLS'yi politikasız etkinleştir (varsayılan ret).
ALTER TABLE public.sistem_bakim_durumu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sistem_bakim_durumu FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.sistem_bakim_durumu FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.sistem_bakim_durumu TO service_role;

-- Bilerek anon/authenticated politikası oluşturulmaz. service_role, Supabase'in
-- BYPASSRLS yetkisiyle günlük bakım kilidini okuyup güncelleyebilir.
