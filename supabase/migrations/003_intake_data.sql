-- Intake data collected during the 4-step form
CREATE TABLE intake_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  dob DATE,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'NY',
  zip TEXT,
  conditions JSONB DEFAULT '[]',
  other_conditions TEXT,
  change_description TEXT,
  adl_levels JSONB DEFAULT '{}',
  adl_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE intake_data ENABLE ROW LEVEL SECURITY;

-- Clients access through case ownership
CREATE POLICY "clients_own_intake_data" ON intake_data
  FOR ALL USING (
    EXISTS (SELECT 1 FROM cases WHERE cases.id = intake_data.case_id AND cases.user_id = auth.uid())
  );

-- Admins access all
CREATE POLICY "admin_all_intake_data" ON intake_data
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER intake_data_updated_at
  BEFORE UPDATE ON intake_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
