-- Billing records
CREATE TABLE billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
  stage INTEGER NOT NULL CHECK (stage IN (1, 2, 3)),
  amount INTEGER NOT NULL, -- in cents
  type TEXT NOT NULL CHECK (type IN ('stage_fee', 'white_glove')),
  stripe_payment_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE billing ENABLE ROW LEVEL SECURITY;

-- Clients see their own billing
CREATE POLICY "clients_own_billing" ON billing
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM cases WHERE cases.id = billing.case_id AND cases.user_id = auth.uid())
  );

-- Admins full access
CREATE POLICY "admin_all_billing" ON billing
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
