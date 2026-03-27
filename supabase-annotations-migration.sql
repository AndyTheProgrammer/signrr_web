-- Run this in your Supabase SQL Editor

-- 1. Add 'cancelled' to documents status constraint
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE documents ADD CONSTRAINT documents_status_check
  CHECK (status IN ('draft', 'pending', 'completed', 'cancelled'));

-- 2. Add annotations_data column to signers (stores text/date annotations as JSON)
ALTER TABLE signers ADD COLUMN IF NOT EXISTS annotations_data JSONB;
