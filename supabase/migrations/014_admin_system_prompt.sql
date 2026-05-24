-- Admin-customizable system prompt for the Stage 1 request letter.
CREATE TABLE ai_prompts (
  key TEXT PRIMARY KEY CHECK (
    key IN (
      'stage1_request_system',
      'stage1_lomn_system',
      'stage2_appeal_system',
      'stage3_hearing_system',
      'stage3_memo_system',
      'ocr_extraction'
    )
  ),
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ai_prompts_updated_by_idx ON ai_prompts(updated_by);

ALTER TABLE ai_prompts ENABLE ROW LEVEL SECURITY;

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

CREATE TRIGGER ai_prompts_updated_at
  BEFORE UPDATE ON ai_prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
