-- Documents (both AI-generated and uploaded)
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('generated', 'uploaded')),
  stage INTEGER NOT NULL CHECK (stage IN (1, 2, 3)),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'review_needed', 'uploaded', 'reviewed')),
  format TEXT CHECK (format IN ('letter', 'pdf', 'image')),
  storage_path TEXT,
  ocr_text TEXT,
  content TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_own_documents" ON documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM cases WHERE cases.id = documents.case_id AND cases.user_id = auth.uid())
  );

CREATE POLICY "admin_all_documents" ON documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Document version history
CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  version INTEGER NOT NULL,
  content TEXT,
  author TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_own_document_versions" ON document_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN cases c ON c.id = d.case_id
      WHERE d.id = document_versions.document_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "admin_all_document_versions" ON document_versions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Document comments
CREATE TABLE document_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES profiles(id) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_own_document_comments" ON document_comments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN cases c ON c.id = d.case_id
      WHERE d.id = document_comments.document_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "admin_all_document_comments" ON document_comments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
