-- Add signed_file_path column to documents table
-- Run this in Supabase SQL Editor

ALTER TABLE documents ADD COLUMN IF NOT EXISTS signed_file_path TEXT;
