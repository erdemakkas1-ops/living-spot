CREATE POLICY "is_fotolari_read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'is-fotolari');
CREATE POLICY "is_fotolari_insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'is-fotolari');
CREATE POLICY "is_fotolari_update" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'is-fotolari');