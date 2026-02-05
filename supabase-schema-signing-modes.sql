-- Add signing_mode to documents table
-- Run this SQL in your Supabase SQL Editor

-- Add signing_mode column to documents table
ALTER TABLE documents
ADD COLUMN signing_mode TEXT CHECK (signing_mode IN ('simple', 'positioned')) DEFAULT 'simple';

-- Add signature_position column to signers table (stores x, y coordinates for positioned mode)
ALTER TABLE signers
ADD COLUMN signature_position JSONB;

-- Add comment for clarity
COMMENT ON COLUMN documents.signing_mode IS 'Signing mode: simple (just signature) or positioned (place on PDF)';
COMMENT ON COLUMN signers.signature_position IS 'JSON object with x, y, page for positioned signatures';

-- Show success message
DO $$
BEGIN
  RAISE NOTICE '✓ Signing modes added successfully!';
  RAISE NOTICE 'Documents can now use "simple" or "positioned" signing modes';
END $$;
