-- Constrain contact_submissions.status to the workflow values the admin UI
-- uses, and let admins update rows (existing admin_only_contact is SELECT-only).

ALTER TABLE contact_submissions
  ADD CONSTRAINT contact_submissions_status_check
  CHECK (status IN ('new', 'contacted', 'resolved'));

CREATE POLICY "admin_update_contact" ON contact_submissions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
