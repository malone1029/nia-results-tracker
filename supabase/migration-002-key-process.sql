-- Migration 002: Add is_key flag to processes
-- Run this in the Supabase SQL Editor

ALTER TABLE processes
ADD COLUMN is_key boolean NOT NULL DEFAULT false;
