-- Contact form submissions (from marketing site)
CREATE TABLE contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

-- Only admins can read contact submissions
CREATE POLICY "admin_only_contact" ON contact_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Anyone can insert (public form) - using service role key bypasses RLS anyway
-- But we add a permissive insert policy just in case
CREATE POLICY "public_insert_contact" ON contact_submissions
  FOR INSERT WITH CHECK (true);
