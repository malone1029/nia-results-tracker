-- Add initial improvement tasks to the Organizational Performance Management process

INSERT INTO process_tasks (
  process_id,
  title,
  description,
  pdca_section,
  adli_dimension,
  source,
  status,
  origin,
  priority
)
SELECT
  p.id,
  task.title,
  task.description,
  task.pdca_section,
  task.adli_dimension,
  'user_created',
  'active',
  'hub_manual',
  task.priority
FROM processes p
CROSS JOIN (VALUES
  (
    'Link Studer survey metrics to this process',
    'Connect the existing MDS Overall Mean, BSS Overall Mean, and EE Overall Mean metrics to this process via the Data Health page or AI coach. These are the primary measurement indicators for this process.',
    'plan',
    'approach',
    'high'
  ),
  (
    'Run ADLI maturity scoring via AI coach',
    'Open the AI coach panel on this process and request an ADLI maturity score across all four dimensions. Use the scored results to identify which dimension to prioritize first for improvement.',
    'evaluate',
    'learning',
    'high'
  ),
  (
    'Map Baldrige criteria 4.1a and 4.1b to this process',
    'Go to the Criteria page and map the 4.1 Measurement, Analysis, and Improvement questions to this process. This will strengthen the Application Readiness score and ensure examiner questions are answered.',
    'plan',
    'integration',
    'medium'
  ),
  (
    'Identify and onboard all NIA process owners into the Hub',
    'Create a list of NIA department and program leads who own documented processes. Confirm each owner is registered in the Hub and has at least one process assigned to them.',
    'execute',
    'deployment',
    'high'
  ),
  (
    'Establish quarterly ADLI review cadence',
    'Schedule a recurring quarterly review meeting or task to reassess ADLI scores across all processes. This is the core rhythm of the performance management cycle described in the workflow.',
    'plan',
    'approach',
    'medium'
  )
) AS task(title, description, pdca_section, adli_dimension, priority)
WHERE p.name = 'Organizational Performance Management';
