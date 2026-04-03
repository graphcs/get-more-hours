-- Storage bucket policies
-- Run these after creating the 'documents' and 'generated' buckets in Supabase Dashboard

-- Documents bucket: clients can upload/read files in their own case folder
CREATE POLICY "clients_upload_own_docs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id::text = (storage.foldername(name))[1]
      AND cases.user_id = auth.uid()
    )
  );

CREATE POLICY "clients_read_own_docs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id::text = (storage.foldername(name))[1]
      AND cases.user_id = auth.uid()
    )
  );

-- Admins can read all documents
CREATE POLICY "admin_read_all_docs" ON storage.objects
  FOR SELECT USING (
    bucket_id IN ('documents', 'generated') AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Generated bucket: read-only for clients (server writes via service role)
CREATE POLICY "clients_read_own_generated" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'generated' AND
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id::text = (storage.foldername(name))[1]
      AND cases.user_id = auth.uid()
    )
  );
