-- Migration 005: Update RLS policies to require authentication
-- Run this in your Supabase SQL Editor AFTER enabling Google Auth
--
-- This replaces all blanket "USING (true)" policies with "USING (auth.uid() IS NOT NULL)"
-- so only signed-in users can read or write data.
-- No per-user ownership filtering — the entire NIA team shares all data.

-- ============================================================
-- 1. categories
-- ============================================================
DROP POLICY IF EXISTS "Allow public read on categories" ON categories;
DROP POLICY IF EXISTS "Allow public insert on categories" ON categories;

CREATE POLICY "Authenticated read on categories" ON categories FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert on categories" ON categories FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- 2. processes
-- ============================================================
DROP POLICY IF EXISTS "Allow public read on processes" ON processes;
DROP POLICY IF EXISTS "Allow public insert on processes" ON processes;
DROP POLICY IF EXISTS "Allow public update on processes" ON processes;
DROP POLICY IF EXISTS "Allow public delete on processes" ON processes;

CREATE POLICY "Authenticated read on processes" ON processes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert on processes" ON processes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update on processes" ON processes FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete on processes" ON processes FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 3. metrics
-- ============================================================
DROP POLICY IF EXISTS "Allow public read on metrics" ON metrics;
DROP POLICY IF EXISTS "Allow public insert on metrics" ON metrics;
DROP POLICY IF EXISTS "Allow public update on metrics" ON metrics;
DROP POLICY IF EXISTS "Allow public delete on metrics" ON metrics;

CREATE POLICY "Authenticated read on metrics" ON metrics FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert on metrics" ON metrics FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update on metrics" ON metrics FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete on metrics" ON metrics FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 4. entries
-- ============================================================
DROP POLICY IF EXISTS "Allow public read on entries" ON entries;
DROP POLICY IF EXISTS "Allow public insert on entries" ON entries;
DROP POLICY IF EXISTS "Allow public update on entries" ON entries;
DROP POLICY IF EXISTS "Allow public delete on entries" ON entries;

CREATE POLICY "Authenticated read on entries" ON entries FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert on entries" ON entries FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update on entries" ON entries FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete on entries" ON entries FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 5. key_requirements
-- ============================================================
DROP POLICY IF EXISTS "Allow public read on key_requirements" ON key_requirements;
DROP POLICY IF EXISTS "Allow public insert on key_requirements" ON key_requirements;
DROP POLICY IF EXISTS "Allow public update on key_requirements" ON key_requirements;
DROP POLICY IF EXISTS "Allow public delete on key_requirements" ON key_requirements;

CREATE POLICY "Authenticated read on key_requirements" ON key_requirements FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert on key_requirements" ON key_requirements FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update on key_requirements" ON key_requirements FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete on key_requirements" ON key_requirements FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 6. metric_requirements
-- ============================================================
DROP POLICY IF EXISTS "Allow public read on metric_requirements" ON metric_requirements;
DROP POLICY IF EXISTS "Allow public insert on metric_requirements" ON metric_requirements;
DROP POLICY IF EXISTS "Allow public delete on metric_requirements" ON metric_requirements;

CREATE POLICY "Authenticated read on metric_requirements" ON metric_requirements FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert on metric_requirements" ON metric_requirements FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete on metric_requirements" ON metric_requirements FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 7. process_requirements
-- ============================================================
DROP POLICY IF EXISTS "Allow public read on process_requirements" ON process_requirements;
DROP POLICY IF EXISTS "Allow public insert on process_requirements" ON process_requirements;
DROP POLICY IF EXISTS "Allow public delete on process_requirements" ON process_requirements;

CREATE POLICY "Authenticated read on process_requirements" ON process_requirements FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert on process_requirements" ON process_requirements FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete on process_requirements" ON process_requirements FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 8. process_history
-- ============================================================
DROP POLICY IF EXISTS "Allow public read on process_history" ON process_history;
DROP POLICY IF EXISTS "Allow public insert on process_history" ON process_history;

CREATE POLICY "Authenticated read on process_history" ON process_history FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert on process_history" ON process_history FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- 9. process_files
-- ============================================================
DROP POLICY IF EXISTS "Allow all access to process_files" ON process_files;

CREATE POLICY "Authenticated read on process_files" ON process_files FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert on process_files" ON process_files FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update on process_files" ON process_files FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete on process_files" ON process_files FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- 10. process_adli_scores
-- ============================================================
DROP POLICY IF EXISTS "Allow all access to process_adli_scores" ON process_adli_scores;

CREATE POLICY "Authenticated read on process_adli_scores" ON process_adli_scores FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert on process_adli_scores" ON process_adli_scores FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update on process_adli_scores" ON process_adli_scores FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete on process_adli_scores" ON process_adli_scores FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Done! All tables now require a signed-in user.
-- The middleware handles redirecting unauthenticated users to /login.
-- ============================================================
