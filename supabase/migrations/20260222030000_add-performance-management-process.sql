-- Insert the Organizational Performance Management process
-- This process documents the Excellence Hub itself as a Baldrige Category 4 key process.

INSERT INTO processes (
  name,
  category_id,
  baldrige_item,
  owner,
  process_type,
  description,
  status,
  template_type,
  charter,
  adli_approach,
  adli_deployment,
  adli_learning,
  adli_integration,
  workflow
)
VALUES (
  'Organizational Performance Management',

  (SELECT id FROM categories WHERE sort_order = 4),

  '4.1',

  'Jon Malone',

  'key',

  'NIA''s systematic approach to collecting, analyzing, reviewing, and acting on organizational performance data using the Baldrige Excellence Framework. The NIA Excellence Hub is the enabling platform for this process.',

  'ready_for_review',

  'full',

  -- Charter
  jsonb_build_object(
    'purpose', 'To systematically collect, analyze, review, and act on performance data across all NIA service areas — guided by the Baldrige Excellence Framework — so NIA can demonstrate continuous improvement, meet stakeholder requirements, and produce credible evidence for the annual IIASA Baldrige application.',
    'scope_includes', 'Selection and maintenance of performance metrics across all 6 Baldrige process categories and Category 7 results; documentation and health assessment of all NIA key and support processes; ADLI maturity scoring and gap analysis for each documented process; Studer survey data integration (MDS, BSS, EE); third-party metric integration (Resolve help desk; future Tick staffing data); improvement action tracking from identification through completion; Baldrige Application Readiness scoring and narrative draft generation.',
    'scope_excludes', 'Day-to-day operational execution of the processes documented here; data collection for processes not yet onboarded to the Hub; personnel performance management (handled through HR processes).',
    'stakeholders', jsonb_build_array(
      'NIA Executive Leadership — primary consumers of performance data and readiness scores',
      'Process Owners — responsible for area-level documentation, metric entry, and improvement actions',
      'NIA Governing Board — receives performance summary at appropriate intervals',
      'IIASA/Baldrige Examiners — external reviewers of documented evidence',
      'All NIA Staff — users of the processes documented here'
    ),
    'mission_alignment', 'NIA''s mission is to provide high-quality shared services to member school districts. Systematic performance management ensures those services are measurably improving, that resources are directed to highest-impact areas, and that NIA can demonstrate its value through verifiable evidence — supporting every district we serve.'
  ),

  -- Approach
  jsonb_build_object(
    'evidence_base', 'The Baldrige Education Criteria for Performance Excellence (ADLI maturity rubric, LeTCI analysis framework). Studer Group Education Partner Survey methodology for stakeholder experience data. IIASA Continuous Improvement Recognition Program requirements as the applied assessment context.',
    'key_steps', jsonb_build_array(
      'Identify and document NIA processes across all 6 Baldrige categories',
      'Define performance metrics for each process, linked to stakeholder Key Requirements',
      'Collect metric data on defined cadence (monthly, quarterly, semi-annual, annual)',
      'Score ADLI maturity for each process (1–5 per dimension)',
      'Compute process health scores across 5 dimensions (Documentation, Maturity, Measurement, Operations, Freshness)',
      'Review performance data against targets and prior periods using LeTCI analysis',
      'Generate and assign improvement actions via AI coaching and human review',
      'Track improvements through completion; update ADLI documentation to reflect learning',
      'Produce annual Baldrige Application Readiness assessment and Excellence Builder narratives'
    ),
    'tools_used', jsonb_build_array(
      'NIA Excellence Hub — primary platform for process documentation, metrics, ADLI scoring, health scoring, and AI coaching',
      'Supabase — performance data storage and retrieval',
      'Asana — improvement task management and tracking',
      'Resolve Help Desk — auto-synced Technology Support and HR Support metrics',
      'Studer Group MDS, BSS, and EE surveys — primary stakeholder experience data',
      'Claude AI (Anthropic) — ADLI coaching, improvement recommendations, gap analysis, workflow diagramming'
    ),
    'key_requirements', 'Process owners and leadership need accurate, timely performance data that is easy to understand and clearly connected to improvement actions. The system must be low-friction enough that data entry happens consistently and process documentation stays current.'
  ),

  -- Deployment
  jsonb_build_object(
    'teams', jsonb_build_array(
      'Hub Administrator (Jon Malone) — system configuration, metric setup, ADLI coaching, data quality review',
      'Process Owners (NIA department and program leads) — documentation, metric entry, and improvement action ownership',
      'NIA Executive Team — quarterly performance review consumers'
    ),
    'communication_plan', 'Performance health scores and process maturity summaries are available real-time via the Hub dashboard. Process owners are notified when metrics become due for review. An annual Baldrige readiness report is produced for the IIASA application cycle.',
    'training_approach', 'Built-in help system (50-item FAQ, 15 contextual tooltips, 5-step dashboard tour, AI help chat on every page). Process-specific coaching is embedded in each process detail page. Hub administrator available for 1-on-1 onboarding support during initial process documentation.',
    'consistency_mechanisms', 'Metric review status indicators enforce cadence (Current / Due Soon / Overdue). Standardized ADLI template fields across all processes. Baldrige criteria database mapped to processes for gap visibility. Asana task sync ensures improvement actions are tracked to completion and not abandoned.'
  ),

  -- Learning
  jsonb_build_object(
    'metrics', jsonb_build_array(
      'Organizational readiness score (0–100, target: 70+)',
      'Key processes with Approved status (target: all key processes)',
      'Metrics current vs. overdue (target: <10% overdue at any point)',
      'Studer MDS Overall Mean (target: 4.0+ on 5-point scale)',
      'Studer BSS Overall Mean (target: 4.0+ on 5-point scale)',
      'Studer EE Overall Mean (target: 4.0+ on 5-point scale)',
      'Improvement actions completed within 90 days (target: 80%)'
    ),
    'evaluation_methods', 'Quarterly ADLI health review across all processes. Annual LeTCI analysis compared to prior year and Studer benchmark groups. Baldrige Application Readiness score as annual summative assessment. Monthly metric data review for operational pulse.',
    'review_frequency', 'Operational metrics: monthly. Process ADLI scores: quarterly. Full Baldrige readiness assessment: annual (aligned to IIASA application cycle). System effectiveness review (Is the Hub serving its purpose?): annual.',
    'improvement_process', 'Improvements identified through: (1) AI coach recommendations per process; (2) Baldrige gap analysis identifying unmapped criteria; (3) Process health scores flagging weak dimensions; (4) User feedback submitted through the Hub feedback modal. Improvements are logged in the improvement journal and tracked as Asana tasks through completion.'
  ),

  -- Integration
  jsonb_build_object(
    'strategic_goals', jsonb_build_array(
      'Achieve Baldrige recognition through the IIASA application program',
      'Demonstrate measurable year-over-year improvement in Studer stakeholder satisfaction scores',
      'Ensure all NIA key processes are systematically managed and improving',
      'Build internal capacity for data-driven decision making across NIA'
    ),
    'mission_connection', 'By systematically measuring and improving every NIA process, this performance management system is the operating mechanism by which NIA fulfills its obligation to member districts — not just delivering services, but continuously improving how those services are delivered.',
    'related_processes', jsonb_build_array(
      'All Category 1–6 processes — this process governs how they are documented, measured, and improved',
      'MDS Survey Administration — source of Category 4/6 metrics for Special Education services',
      'BSS Internal Survey — source of Category 1/5 metrics for internal support departments',
      'EE Employee Engagement Survey — source of Category 5 workforce metrics',
      'Technology Support — Resolve integration provides monthly resolution and satisfaction metrics',
      'HR Support — Resolve integration provides monthly resolution and satisfaction metrics'
    ),
    'standards_alignment', 'Baldrige Education Criteria for Performance Excellence (primary framework); Studer Group Education Partner Survey methodology (benchmarking and item design); IIASA Continuous Improvement Recognition Program (applied assessment and recognition context).'
  ),

  -- Workflow
  jsonb_build_object(
    'inputs', jsonb_build_array(
      'Studer survey results (MDS, BSS, EE) — delivered by Studer Group semi-annually and annually',
      'Help desk data from Resolve — auto-synced to Hub monthly',
      'Process owner ADLI self-assessments and documentation updates',
      'AI coach recommendations generated per-process on demand',
      'Improvement action status updates from Asana'
    ),
    'steps', jsonb_build_array(
      jsonb_build_object('responsible', 'Hub Administrator', 'action', 'Onboard new processes with initial Charter and description', 'output', 'Draft process records in Hub', 'timing', 'As new processes are identified'),
      jsonb_build_object('responsible', 'Process Owners', 'action', 'Complete Charter and ADLI documentation for owned processes', 'output', 'Approved process documentation', 'timing', 'Quarterly'),
      jsonb_build_object('responsible', 'Hub Administrator', 'action', 'Enter Studer survey results when received from Studer Group', 'output', 'Updated MDS, BSS, and EE metric entries with trend data', 'timing', 'Semi-annual (MDS, BSS) and annual (EE)'),
      jsonb_build_object('responsible', 'Resolve (automated)', 'action', 'Sync monthly ticket resolution and satisfaction data to Hub', 'output', 'Updated Technology Support and HR Support metric entries', 'timing', 'Monthly'),
      jsonb_build_object('responsible', 'Process Owners', 'action', 'Review AI coaching recommendations and commit improvement actions', 'output', 'Improvement journal entries and Asana tasks', 'timing', 'Quarterly'),
      jsonb_build_object('responsible', 'Hub Administrator', 'action', 'Run ADLI maturity scoring review across all processes', 'output', 'Updated ADLI scores and process health reports', 'timing', 'Quarterly'),
      jsonb_build_object('responsible', 'Hub Administrator', 'action', 'Generate Baldrige Application Readiness report and Excellence Builder drafts', 'output', 'Annual readiness score, gap analysis, and narrative drafts', 'timing', 'Annual — aligned to IIASA application cycle'),
      jsonb_build_object('responsible', 'NIA Leadership', 'action', 'Review performance dashboard and approve improvement priorities', 'output', 'Strategic direction for the next period', 'timing', 'Quarterly')
    ),
    'outputs', jsonb_build_array(
      'Documented process library for all NIA key and support processes',
      'Performance metrics time series (historic and current)',
      'ADLI maturity scores per process',
      'Improvement action log tracked to completion',
      'Annual Baldrige Application Readiness report',
      'Excellence Builder narrative drafts for IIASA application'
    ),
    'quality_controls', jsonb_build_array(
      'Metric review status indicators alert when data entry is overdue',
      'Process health score flags documentation gaps before they compound',
      'Baldrige criteria mapping ensures no Category goes unaddressed',
      'AI coaching provides consistent, framework-aligned recommendations across all processes'
    )
  )
);
