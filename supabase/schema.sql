-- NIA Results Tracker Database Schema
-- Baldrige Categories 1-6 (Category 7 omitted — this tracker builds Category 7 evidence)

-- Categories table: Baldrige framework categories
create table categories (
  id serial primary key,
  name text not null unique,         -- e.g., "1-Leadership"
  display_name text not null,        -- e.g., "Leadership"
  sort_order integer not null
);

-- Processes table: organizational processes within each category
create table processes (
  id serial primary key,
  category_id integer references categories(id) on delete cascade,
  name text not null,                -- e.g., "Strategic Direction Process"
  description text,
  baldrige_item text                 -- e.g., "1.1a" for specific Baldrige item reference
);

-- Metrics table: individual measurements tracked over time
create table metrics (
  id serial primary key,
  process_id integer references processes(id) on delete cascade,
  name text not null,                -- e.g., "Employee Experience Overall Score"
  description text,
  cadence text not null check (cadence in ('monthly', 'quarterly', 'semi-annual', 'annual')),
  target_value numeric,              -- goal to hit (null = TBD)
  comparison_value numeric,          -- benchmark/peer value for LeTCI Comparisons
  comparison_source text,            -- e.g., "National average" or "Studer benchmark"
  data_source text,                  -- e.g., "Studer EE Survey"
  collection_method text,            -- e.g., "Semi-annual survey"
  unit text default '%',             -- %, count, currency, score, days, rate
  is_higher_better boolean default true,  -- determines trend color (false = lower is better, like phishing click rate)
  is_integrated boolean default false    -- LeTCI Integration: results used in decision-making and connected to org priorities
);

-- Entries table: individual data points logged over time
create table entries (
  id serial primary key,
  metric_id integer references metrics(id) on delete cascade,
  value numeric not null,
  date date not null,
  note_analysis text,                -- contextual explanation (e.g., "new survey methodology")
  note_course_correction text,       -- action taken when missing targets (e.g., "added re-training")
  created_at timestamptz default now()
);

-- Indexes for common queries
create index idx_entries_metric_id on entries(metric_id);
create index idx_entries_date on entries(date);
create index idx_metrics_process_id on metrics(process_id);
create index idx_processes_category_id on processes(category_id);

-- Allow public access (no auth for now — will add RLS in a future project)
alter table categories enable row level security;
alter table processes enable row level security;
alter table metrics enable row level security;
alter table entries enable row level security;

-- Public read/write policies
create policy "Allow public read on categories" on categories for select using (true);
create policy "Allow public read on processes" on processes for select using (true);
create policy "Allow public read on metrics" on metrics for select using (true);
create policy "Allow public read on entries" on entries for select using (true);

create policy "Allow public insert on entries" on entries for insert with check (true);
create policy "Allow public update on entries" on entries for update using (true);
create policy "Allow public delete on entries" on entries for delete using (true);

create policy "Allow public insert on metrics" on metrics for insert with check (true);
create policy "Allow public update on metrics" on metrics for update using (true);
create policy "Allow public delete on metrics" on metrics for delete using (true);

create policy "Allow public insert on processes" on processes for insert with check (true);
create policy "Allow public insert on categories" on categories for insert with check (true);

-- Seed the 6 Baldrige categories (Category 7 omitted)
insert into categories (name, display_name, sort_order) values
  ('1-Leadership', 'Leadership', 1),
  ('2-Strategy', 'Strategy', 2),
  ('3-Customers', 'Customers', 3),
  ('4-Measurement', 'Measurement, Analysis & Knowledge Management', 4),
  ('5-Workforce', 'Workforce', 5),
  ('6-Operations', 'Operations', 6);
