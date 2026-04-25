-- Fix recursive RLS on profiles and centralize the admin check.
--
-- The original `admin_view_all_profiles` policy queried `profiles` from within
-- a policy on `profiles`, which Postgres flags as infinite recursion. The
-- effect: when embedding `profile:profiles(*)` through cases/documents/etc.,
-- the profiles rows come back as NULL — making every row on the admin page
-- render as "Unknown" and making `.single()` queries with the embed fail.
--
-- Fix: introduce a SECURITY DEFINER helper that bypasses RLS on the lookup,
-- then swap every admin policy to use it. The function only returns a boolean
-- about the caller (`auth.uid()`), so it does not leak row data.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- profiles: break the recursion
DROP POLICY IF EXISTS "admin_view_all_profiles" ON profiles;
CREATE POLICY "admin_view_all_profiles" ON profiles
  FOR SELECT USING (public.is_admin());

-- cases
DROP POLICY IF EXISTS "admin_all_cases" ON cases;
CREATE POLICY "admin_all_cases" ON cases
  FOR ALL USING (public.is_admin());

-- intake_data
DROP POLICY IF EXISTS "admin_all_intake_data" ON intake_data;
CREATE POLICY "admin_all_intake_data" ON intake_data
  FOR ALL USING (public.is_admin());

-- documents
DROP POLICY IF EXISTS "admin_all_documents" ON documents;
CREATE POLICY "admin_all_documents" ON documents
  FOR ALL USING (public.is_admin());

-- document_versions
DROP POLICY IF EXISTS "admin_all_document_versions" ON document_versions;
CREATE POLICY "admin_all_document_versions" ON document_versions
  FOR ALL USING (public.is_admin());

-- document_comments
DROP POLICY IF EXISTS "admin_all_document_comments" ON document_comments;
CREATE POLICY "admin_all_document_comments" ON document_comments
  FOR ALL USING (public.is_admin());

-- billing
DROP POLICY IF EXISTS "admin_all_billing" ON billing;
CREATE POLICY "admin_all_billing" ON billing
  FOR ALL USING (public.is_admin());

-- crm_notes
DROP POLICY IF EXISTS "admin_only_crm_notes" ON crm_notes;
CREATE POLICY "admin_only_crm_notes" ON crm_notes
  FOR ALL USING (public.is_admin());

-- contact_submissions
DROP POLICY IF EXISTS "admin_only_contact" ON contact_submissions;
CREATE POLICY "admin_only_contact" ON contact_submissions
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admin_update_contact" ON contact_submissions;
CREATE POLICY "admin_update_contact" ON contact_submissions
  FOR UPDATE USING (public.is_admin());

-- storage.objects: admin read of documents/generated buckets
DROP POLICY IF EXISTS "admin_read_all_docs" ON storage.objects;
CREATE POLICY "admin_read_all_docs" ON storage.objects
  FOR SELECT USING (
    bucket_id IN ('documents', 'generated') AND public.is_admin()
  );
