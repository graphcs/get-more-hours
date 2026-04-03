-- Profiles table extending Supabase auth.users
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'client' CHECK (role IN ('client', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "users_view_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Admins can view all profiles
CREATE POLICY "admin_view_all_profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow inserts for new users (auth callback creates profile)
CREATE POLICY "users_insert_own_profile" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
