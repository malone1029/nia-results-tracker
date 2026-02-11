-- Migration 016: Baldrige narrative drafts
-- Stores narrative drafts for each Baldrige item, one per item per tier.
-- Used for building the 25-page (EB) and 50-page (full) applications.

CREATE TABLE IF NOT EXISTS baldrige_drafts (
  id              SERIAL PRIMARY KEY,
  item_id         INTEGER NOT NULL REFERENCES baldrige_items(id) ON DELETE CASCADE,
  tier            TEXT NOT NULL DEFAULT 'excellence_builder' CHECK (tier IN ('excellence_builder', 'full')),
  narrative_text  TEXT NOT NULL DEFAULT '',
  figures         JSONB NOT NULL DEFAULT '[]',
  word_count      INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'final')),
  last_ai_generated_at TIMESTAMPTZ,
  last_edited_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One draft per item per tier
CREATE UNIQUE INDEX IF NOT EXISTS idx_baldrige_drafts_item_tier ON baldrige_drafts(item_id, tier);

-- Fast lookups by item
CREATE INDEX IF NOT EXISTS idx_baldrige_drafts_item ON baldrige_drafts(item_id);

-- RLS: all authenticated users can read, only admins can write
-- Uses is_admin() SECURITY DEFINER function to avoid cross-table RLS issues
ALTER TABLE baldrige_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read drafts"
  ON baldrige_drafts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert drafts"
  ON baldrige_drafts FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update drafts"
  ON baldrige_drafts FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete drafts"
  ON baldrige_drafts FOR DELETE
  USING (is_admin());
