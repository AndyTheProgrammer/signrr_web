-- SignrR MVP Database Schema - FIXED (No Infinite Recursion)
-- Run this in Supabase SQL Editor to fix the infinite recursion issue
-- This will DROP existing policies and recreate them without circular dependencies

-- ============================================
-- DROP EXISTING POLICIES (if they exist)
-- ============================================
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
DROP POLICY IF EXISTS "Users can view documents they're signing" ON documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;

DROP POLICY IF EXISTS "Document owners can view signers" ON signers;
DROP POLICY IF EXISTS "Signers can view their own records" ON signers;
DROP POLICY IF EXISTS "Document owners can insert signers" ON signers;
DROP POLICY IF EXISTS "Signers can update their own records" ON signers;

-- ============================================
-- SECURITY DEFINER FUNCTIONS (bypass RLS)
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
-- RLS POLICIES FOR DOCUMENTS (using helper functions)
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
-- RLS POLICIES FOR SIGNERS (using helper functions)
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
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✓ RLS policies fixed successfully!';
  RAISE NOTICE '✓ Infinite recursion issue resolved';
  RAISE NOTICE 'The policies now use SECURITY DEFINER functions to bypass RLS during checks';
END $$;
