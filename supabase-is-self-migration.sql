-- Migration: add is_self column to signers table
-- Run this in the Supabase SQL editor or via CLI
ALTER TABLE signers ADD COLUMN IF NOT EXISTS is_self boolean DEFAULT false;
