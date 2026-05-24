CREATE INDEX IF NOT EXISTS ai_prompts_updated_by_idx ON ai_prompts(updated_by);

DROP POLICY IF EXISTS "admin_read_ai_prompts" ON ai_prompts;
DROP POLICY IF EXISTS "admin_insert_ai_prompts" ON ai_prompts;
DROP POLICY IF EXISTS "admin_update_ai_prompts" ON ai_prompts;
DROP POLICY IF EXISTS "admin_delete_ai_prompts" ON ai_prompts;

CREATE POLICY "admin_read_ai_prompts" ON ai_prompts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

CREATE POLICY "admin_insert_ai_prompts" ON ai_prompts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

CREATE POLICY "admin_update_ai_prompts" ON ai_prompts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );

CREATE POLICY "admin_delete_ai_prompts" ON ai_prompts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'admin')
  );
