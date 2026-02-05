-- SignrR MVP Database Schema
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- ============================================
-- USER PROFILES TABLE
-- ============================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DOCUMENTS TABLE
-- ============================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT CHECK (status IN ('draft', 'pending', 'completed')),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  current_signer_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- SIGNERS TABLE
-- ============================================
CREATE TABLE signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  signing_order INTEGER NOT NULL,
  status TEXT CHECK (status IN ('pending', 'signed')),
  magic_token TEXT UNIQUE,
  magic_token_expires_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  signature_data TEXT,
  UNIQUE(document_id, signing_order)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_documents_owner_id ON documents(owner_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_signers_document_id ON signers(document_id);
CREATE INDEX idx_signers_magic_token ON signers(magic_token);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE signers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES FOR USER_PROFILES
-- ============================================
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- SECURITY DEFINER FUNCTIONS (bypass RLS to prevent infinite recursion)
-- ============================================

-- Function to check if user is document owner (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_document_owner(doc_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM documents
    WHERE id = doc_id AND owner_id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is a signer (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_document_signer(doc_id UUID, user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM signers
    WHERE document_id = doc_id AND email = user_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RLS POLICIES FOR DOCUMENTS
-- ============================================
CREATE POLICY "Users can view their own documents"
  ON documents FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can view documents they're signing"
  ON documents FOR SELECT
  USING (is_document_signer(id, auth.email()));

CREATE POLICY "Users can insert their own documents"
  ON documents FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own documents"
  ON documents FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own documents"
  ON documents FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================
-- RLS POLICIES FOR SIGNERS
-- ============================================
CREATE POLICY "Document owners can view signers"
  ON signers FOR SELECT
  USING (is_document_owner(document_id, auth.uid()));

CREATE POLICY "Signers can view their own records"
  ON signers FOR SELECT
  USING (email = auth.email());

CREATE POLICY "Document owners can insert signers"
  ON signers FOR INSERT
  WITH CHECK (is_document_owner(document_id, auth.uid()));

CREATE POLICY "Signers can update their own records"
  ON signers FOR UPDATE
  USING (email = auth.email());

-- ============================================
-- HELPER FUNCTION: Auto-create user profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile when user signs up
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'SignrR database schema created successfully!';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Create a storage bucket named "documents" in Supabase Storage';
  RAISE NOTICE '2. Set bucket to private (not public)';
  RAISE NOTICE '3. Configure RLS policies for the storage bucket';
END $$;
