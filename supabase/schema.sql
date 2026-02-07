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
  is_higher_better boolean default true  -- determines trend color (false = lower is better, like phishing click rate)
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

-- Key Requirements table: stakeholder needs from Organizational Profile (Figure P-6)
create table key_requirements (
  id serial primary key,
  stakeholder_segment text not null,   -- "Customers" or "Stakeholders"
  stakeholder_group text not null,     -- e.g., "Member Districts", "Workforce", "Parents"
  requirement text not null,           -- e.g., "High-quality services"
  description text,                    -- optional explanation
  sort_order integer not null
);

-- Junction table: links metrics to key requirements (many-to-many)
create table metric_requirements (
  id serial primary key,
  metric_id integer references metrics(id) on delete cascade,
  requirement_id integer references key_requirements(id) on delete cascade,
  unique (metric_id, requirement_id)
);

-- Indexes for common queries
create index idx_entries_metric_id on entries(metric_id);
create index idx_entries_date on entries(date);
create index idx_metrics_process_id on metrics(process_id);
create index idx_processes_category_id on processes(category_id);
create index idx_metric_requirements_metric_id on metric_requirements(metric_id);
create index idx_metric_requirements_requirement_id on metric_requirements(requirement_id);

-- Allow public access (no auth for now — will add RLS in a future project)
alter table categories enable row level security;
alter table processes enable row level security;
alter table metrics enable row level security;
alter table entries enable row level security;
alter table key_requirements enable row level security;
alter table metric_requirements enable row level security;

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

create policy "Allow public read on key_requirements" on key_requirements for select using (true);
create policy "Allow public insert on key_requirements" on key_requirements for insert with check (true);
create policy "Allow public update on key_requirements" on key_requirements for update using (true);
create policy "Allow public delete on key_requirements" on key_requirements for delete using (true);

create policy "Allow public read on metric_requirements" on metric_requirements for select using (true);
create policy "Allow public insert on metric_requirements" on metric_requirements for insert with check (true);
create policy "Allow public delete on metric_requirements" on metric_requirements for delete using (true);

-- Seed the 6 Baldrige categories (Category 7 omitted)
insert into categories (name, display_name, sort_order) values
  ('1-Leadership', 'Leadership', 1),
  ('2-Strategy', 'Strategy', 2),
  ('3-Customers', 'Customers', 3),
  ('4-Measurement', 'Measurement, Analysis & Knowledge Management', 4),
  ('5-Workforce', 'Workforce', 5),
  ('6-Operations', 'Operations', 6);

-- Seed Key Requirements from Organizational Profile (Figure P-6)
insert into key_requirements (stakeholder_segment, stakeholder_group, requirement, sort_order) values
  ('Customers', 'Member Districts', 'Prioritization', 1),
  ('Customers', 'Member Districts', 'High-quality services', 2),
  ('Customers', 'Member Districts', 'Cost effective', 3),
  ('Customers', 'Member Districts', 'Good customer service', 4),
  ('Customers', 'Non-Member Entities', 'High-quality services', 5),
  ('Customers', 'Non-Member Entities', 'Cost effective', 6),
  ('Customers', 'Non-Member Entities', 'Good customer service', 7),
  ('Stakeholders', 'Workforce', 'Competitive compensation/benefits', 8),
  ('Stakeholders', 'Workforce', 'Input and engagement', 9),
  ('Stakeholders', 'Workforce', 'Clear communication', 10),
  ('Stakeholders', 'Workforce', 'Responsive leadership', 11),
  ('Stakeholders', 'Workforce', 'Meaningful work', 12),
  ('Stakeholders', 'Students', 'High-quality services', 13),
  ('Stakeholders', 'Students', 'Engaging service delivery', 14),
  ('Stakeholders', 'Parents', 'High-quality services', 15),
  ('Stakeholders', 'Parents', 'Good communication', 16);
