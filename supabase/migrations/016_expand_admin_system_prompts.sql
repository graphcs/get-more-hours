ALTER TABLE ai_prompts
  DROP CONSTRAINT IF EXISTS ai_prompts_key_check;

ALTER TABLE ai_prompts
  ADD CONSTRAINT ai_prompts_key_check
  CHECK (
    key IN (
      'stage1_request_system',
      'stage1_lomn_system',
      'stage2_appeal_system',
      'stage3_hearing_system',
      'stage3_memo_system',
      'ocr_extraction'
    )
  );
