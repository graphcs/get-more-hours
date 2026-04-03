-- CRM notes (admin-only)
CREATE TABLE crm_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES profiles(id) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE crm_notes ENABLE ROW LEVEL SECURITY;

-- Only admins can access CRM notes
CREATE POLICY "admin_only_crm_notes" ON crm_notes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
