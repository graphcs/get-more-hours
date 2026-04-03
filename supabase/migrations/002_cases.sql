-- Case number sequence
CREATE SEQUENCE case_number_seq START 1000;

-- Generate case number in format GMH-YYYY-XXXX
CREATE OR REPLACE FUNCTION generate_case_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'GMH-' || EXTRACT(YEAR FROM now())::TEXT || '-' || LPAD(nextval('case_number_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Cases table
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  case_number TEXT UNIQUE NOT NULL DEFAULT generate_case_number(),
  current_stage INTEGER DEFAULT 1 CHECK (current_stage IN (1, 2, 3)),
  stage_status TEXT DEFAULT 'pending' CHECK (stage_status IN ('pending', 'in_progress', 'submitted', 'responded', 'complete')),
  tier TEXT DEFAULT 'self_serve' CHECK (tier IN ('self_serve', 'white_glove')),
  mltc TEXT NOT NULL,
  current_hours INTEGER NOT NULL,
  current_days INTEGER NOT NULL,
  requested_hours INTEGER NOT NULL,
  requested_days INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- Clients see only their own cases
CREATE POLICY "clients_own_cases" ON cases
  FOR ALL USING (user_id = auth.uid());

-- Admins see all cases
CREATE POLICY "admin_all_cases" ON cases
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
