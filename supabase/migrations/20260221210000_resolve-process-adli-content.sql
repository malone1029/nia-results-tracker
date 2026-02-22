-- Migration: ADLI + Charter content for Technology Support and HR Support processes
-- Populated based on NIA help desk operations using Resolve.

DO $$
DECLARE
  v_tech_id  INTEGER;
  v_hr_id    INTEGER;
BEGIN

  SELECT id INTO v_tech_id FROM processes WHERE name = 'Technology Support' LIMIT 1;
  SELECT id INTO v_hr_id   FROM processes WHERE name = 'HR Support' LIMIT 1;

  IF v_tech_id IS NULL OR v_hr_id IS NULL THEN
    RAISE EXCEPTION 'Technology Support or HR Support process not found — run migration 20260221200000 first.';
  END IF;

  -- ══════════════════════════════════════════════════════════════
  -- TECHNOLOGY SUPPORT
  -- ══════════════════════════════════════════════════════════════

  UPDATE processes SET
    baldrige_item = '6.2',
    status        = 'draft',
    owner         = 'Technology Department',

    charter = jsonb_build_object(
      'purpose',
        'Ensure all NIA staff have reliable, timely access to the technology tools, systems, and devices '
        'they need to perform their work and deliver services to member districts.',

      'scope_includes',
        'Hardware support (computers, printers, peripherals, mobile devices), software installation and '
        'troubleshooting, network connectivity issues, system and application access provisioning, device '
        'setup for new and departing staff.',

      'scope_excludes',
        'Member district IT support (handled through separate district agreements), capital equipment '
        'purchasing decisions, vendor contract negotiations, cybersecurity policy decisions.',

      'stakeholders', jsonb_build_array(
        'All NIA staff (requesters)',
        'Technology Department (4+ agents and dispatcher)',
        'Executive Team (operational continuity)',
        'Member districts (indirect — NIA service delivery depends on functional technology)'
      ),

      'mission_alignment',
        'NIA''s ability to serve its 35+ member districts depends on a fully functional workforce. Every '
        'unresolved technology issue is a barrier to student-serving work. Fast, reliable technology support '
        'is a direct enabler of NIA''s regional service mission.',

      'content',
        E'## Purpose\nEnsure all NIA staff have reliable, timely access to the technology tools, systems, '
        'and devices they need to perform their work and deliver services to member districts.\n\n'
        '## Scope\n**Includes:** Hardware (computers, printers, peripherals), software, network connectivity, '
        'system access provisioning, new/departing staff device setup.\n\n'
        '**Excludes:** Member district IT support, capital equipment purchasing, vendor contracts, cybersecurity policy.\n\n'
        '## Stakeholders\n- All NIA staff (requesters)\n- Technology Department (agents + dispatcher)\n'
        '- Executive Team (operational continuity)\n- Member districts (indirect beneficiaries)\n\n'
        '## Mission Alignment\nEvery unresolved technology issue is a barrier to student-serving work. '
        'Fast, reliable technology support directly enables NIA''s regional service mission.'
    ),

    adli_approach = jsonb_build_object(
      'evidence_base',
        'Ticket-based support workflow using Resolve help desk; triage and priority-based routing; '
        'structured categories for hardware, software, network, and access requests.',

      'key_steps', jsonb_build_array(
        'Staff submits ticket via Resolve (web or email-to-ticket)',
        'Auto-acknowledgment sent to submitter',
        'Dispatcher or first-available agent triages and assigns priority (low / normal / high / urgent)',
        'Assigned tech agent diagnoses issue and communicates ETA',
        'Resolution implemented and documented in ticket',
        'Ticket closed; satisfaction survey sent automatically',
        'Monthly metrics synced to Hub via /resolve sync page'
      ),

      'tools_used', jsonb_build_array(
        'Resolve (ticket management system)',
        'NIA Excellence Hub (monthly metrics tracking)',
        'Manufacturer and vendor support portals',
        'Internal technology knowledge base'
      ),

      'key_requirements',
        'Timely resolution (target: next business day for standard issues, same day for urgent); '
        'clear communication to requesters throughout; accurate documentation of each resolution; '
        'consistent ticket categorization for trend analysis.',

      'content',
        E'## Approach\nNIA Technology Support uses **Resolve**, a structured help desk system, to intake, '
        'triage, and resolve all staff technology requests. Every request receives a ticket number, '
        'priority classification, and assigned agent.\n\n'
        '### Key Steps\n1. Staff submits ticket via Resolve\n2. Auto-acknowledgment sent\n'
        '3. Dispatcher triages and assigns priority\n4. Agent diagnoses and communicates ETA\n'
        '5. Resolution documented and ticket closed\n6. Satisfaction survey sent automatically\n'
        '7. Monthly metrics synced to Hub\n\n'
        '### Tools\n- **Resolve** — ticket management\n- **NIA Excellence Hub** — metrics tracking\n'
        '- Manufacturer/vendor portals, internal knowledge base\n\n'
        '### Key Requirements\nNext-business-day resolution for standard issues; same-day for urgent. '
        'Clear communication, accurate documentation, consistent categorization.'
    ),

    adli_deployment = jsonb_build_object(
      'teams', jsonb_build_array(
        'Technology Department (4+ agents — triage, diagnosis, resolution)',
        'Dispatcher (routing and priority management)',
        'All NIA staff (requesters — trained on Resolve during onboarding)'
      ),

      'communication_plan',
        'Automated emails via Resolve: (1) acknowledgment on ticket creation, (2) agent reply notification, '
        '(3) resolution confirmation with satisfaction survey link. Dispatcher monitors open queue daily '
        'for overdue items.',

      'training_approach',
        'All new NIA staff shown Resolve ticket submission during onboarding orientation. '
        'Technology agents trained on Resolve workflow, priority protocols, and escalation procedures. '
        'No formal certification required; knowledge is built through practice and peer guidance.',

      'consistency_mechanisms',
        'Resolve enforces structured ticket fields (category, priority, department). '
        'Dispatcher reviews daily to prevent tickets from aging without response. '
        'Monthly Hub sync surfaces resolution time trends for team review.',

      'content',
        E'## Deployment\nThe Technology Department operates the full Resolve ticket workflow. '
        'A dispatcher role manages routing and ensures no ticket goes unattended.\n\n'
        '### Teams\n- **Technology Department (4+ agents)** — triage, diagnosis, and resolution\n'
        '- **Dispatcher** — routing and queue management\n'
        '- **All NIA staff** — requesters, trained during onboarding\n\n'
        '### Communication\nAutomatic emails at each stage: acknowledgment → agent reply → resolution + survey. '
        'Open queue reviewed daily.\n\n'
        '### Consistency\nResolve enforces structured fields. Monthly Hub metrics reveal drift from SLA targets '
        'before they become systemic problems.'
    ),

    adli_learning = jsonb_build_object(
      'metrics', jsonb_build_array(
        'Avg Resolution Time (target: ≤ 24 hours)',
        'Customer Satisfaction Score (target: ≥ 4.5 / 5.0)',
        'Monthly ticket volume',
        'Open ticket count'
      ),

      'evaluation_methods',
        'Monthly metrics auto-synced from Resolve to Hub (Avg Resolution Time and Satisfaction per department). '
        'Satisfaction survey sent on every ticket closure (1–5 star rating + optional comment). '
        'Dispatcher reviews open queue daily; Technology team reviews trend data monthly.',

      'review_frequency',
        'Daily: open queue review by dispatcher. '
        'Monthly: metrics synced to Hub; team reviews resolution time and satisfaction trends. '
        'Annual: full process review as part of NIA''s Baldrige self-assessment cycle.',

      'improvement_process',
        'High-frequency ticket categories trigger knowledge base article creation to enable faster future resolution. '
        'Satisfaction scores below 4.0 trigger root-cause review by dispatcher. '
        'Process changes are documented in the Hub''s Improvements tab with before/after snapshots.',

      'content',
        E'## Learning\n### Metrics Tracked\n- Avg Resolution Time (target ≤ 24h)\n'
        '- Customer Satisfaction Score (target ≥ 4.5/5)\n- Monthly ticket volume and open count\n\n'
        '### How We Evaluate\nEvery closed ticket triggers a satisfaction survey. Monthly metrics are '
        'auto-synced to the Hub from Resolve. The dispatcher reviews the open queue daily.\n\n'
        '### Review Cadence\n- **Daily:** Open queue monitoring\n- **Monthly:** Hub metric review\n'
        '- **Annual:** Full process review during Baldrige self-assessment\n\n'
        '### Improvement Loop\nHigh-frequency issues → KB articles. Satisfaction below 4.0 → root-cause review. '
        'All process changes documented in Hub Improvements tab.'
    ),

    adli_integration = jsonb_build_object(
      'strategic_goals', jsonb_build_array(
        'Operational efficiency — minimize technology disruption to NIA service delivery',
        'Staff empowerment — fast resolution keeps employees productive',
        'Continuous improvement — monthly metrics drive systematic enhancement'
      ),

      'mission_connection',
        'NIA''s 35+ member districts rely on NIA staff to deliver special education, HR, financial, '
        'and instructional services. Any technology failure that affects NIA staff cascades into '
        'delayed district services. Technology Support is a foundational operational process.',

      'related_processes', jsonb_build_array(
        'HR Support (parallel internal service desk — shared Resolve platform and satisfaction metrics)',
        'All program delivery processes (depend on functional technology)',
        'Employee Onboarding (technology provisioning is a key onboarding step)'
      ),

      'standards_alignment',
        'Baldrige Category 6.2 (Work Processes) — effective work process design that supports operational excellence '
        'and meets customer requirements. Also supports Category 5.2 (Workforce Climate) by ensuring staff '
        'have the resources needed to do their jobs effectively.',

      'content',
        E'## Integration\n### Strategic Goals\n- **Operational efficiency** — minimize technology disruption\n'
        '- **Staff empowerment** — fast resolution keeps employees productive\n'
        '- **Continuous improvement** — monthly metrics drive enhancement\n\n'
        '### Mission Connection\nNIA''s 35+ member districts rely on NIA staff to deliver services. '
        'Technology failures cascade into delayed district services. Technology Support is a foundational '
        'operational process that enables everything else.\n\n'
        '### Related Processes\n- HR Support (parallel service desk on Resolve)\n'
        '- All program delivery processes (technology-dependent)\n'
        '- Employee Onboarding (technology provisioning step)\n\n'
        '### Baldrige Alignment\nCategory 6.2 (Work Processes) — effective process design supporting '
        'operational excellence and customer requirements.'
    )

  WHERE id = v_tech_id;

  -- ══════════════════════════════════════════════════════════════
  -- HR SUPPORT
  -- ══════════════════════════════════════════════════════════════

  UPDATE processes SET
    baldrige_item = '5.2',
    status        = 'draft',
    owner         = 'Human Resources Department',

    charter = jsonb_build_object(
      'purpose',
        'Provide NIA staff with timely, accurate, and confidential responses to HR-related inquiries — '
        'including benefits, leave, personnel policies, and employment matters — so staff can focus '
        'on their work with confidence that HR questions will be answered promptly.',

      'scope_includes',
        'Benefits administration questions (health insurance, dental, vision, retirement, FSA/HSA), '
        'leave requests and FMLA guidance, personnel policy interpretation, payroll inquiry routing, '
        'onboarding and offboarding support, general employment questions.',

      'scope_excludes',
        'Formal disciplinary actions (handled through direct supervisor and executive process), '
        'legal counsel on employment disputes (referred to NIA legal counsel), '
        'member district HR matters (separate engagement governed by service agreements).',

      'stakeholders', jsonb_build_array(
        'All NIA staff (requesters)',
        'HR and Finance Executive (oversight, complex and sensitive matters)',
        'HR Coordinator (day-to-day ticket handling)',
        'Administrative Assistant for HR (intake support, scheduling)',
        'Executive Director (personnel policy authority)',
        'Supervisors (supporting staff through HR processes)'
      ),

      'mission_alignment',
        'NIA''s workforce is its most critical asset. Staff who receive prompt, accurate HR support feel '
        'valued and supported, which directly contributes to engagement and retention. An engaged, '
        'stable workforce delivers better outcomes to the member districts NIA serves.',

      'content',
        E'## Purpose\nProvide NIA staff with timely, accurate, and confidential responses to HR-related '
        'inquiries so staff can focus on their work with confidence.\n\n'
        '## Scope\n**Includes:** Benefits questions, leave/FMLA guidance, policy interpretation, '
        'payroll routing, onboarding/offboarding support.\n\n'
        '**Excludes:** Formal disciplinary actions, legal counsel on disputes, member district HR matters.\n\n'
        '## Stakeholders\n- All NIA staff (requesters)\n- HR and Finance Executive (oversight)\n'
        '- HR Coordinator (day-to-day handling)\n- Administrative Assistant for HR (intake support)\n'
        '- Executive Director, Supervisors\n\n'
        '## Mission Alignment\nAn engaged, stable workforce delivers better outcomes to the member districts '
        'NIA serves. HR responsiveness is a direct driver of workforce engagement and retention.'
    ),

    adli_approach = jsonb_build_object(
      'evidence_base',
        'Ticket-based inquiry management using Resolve; confidentiality protocols for sensitive workforce '
        'matters; compliance frameworks for FMLA, HIPAA-covered employee health information, and '
        'Illinois employment law (105 ILCS, School Code provisions applicable to regional agencies).',

      'key_steps', jsonb_build_array(
        'Staff submits HR inquiry via Resolve (web portal)',
        'Auto-acknowledgment sent to submitter',
        'HR team reviews inquiry category and sensitivity level',
        'Assigned to appropriate HR staff (Coordinator for routine; Executive for complex/sensitive)',
        'Research policy, benefits carrier, or applicable regulation as needed',
        'Response provided via Resolve message thread (phone for sensitive matters)',
        'Ticket closed with resolution documented; satisfaction survey sent',
        'Monthly metrics synced to Hub via /resolve sync page'
      ),

      'tools_used', jsonb_build_array(
        'Resolve (ticket management system)',
        'Tick (NIA leave management system — cross-referenced for leave balance questions)',
        'NIA Excellence Hub (monthly metrics tracking)',
        'Benefits carrier portals (IMRF, health/dental/vision plans)',
        'NIA Personnel Policy Manual',
        'ISBE and IASB reference resources for compliance questions'
      ),

      'key_requirements',
        'Confidentiality for all HR inquiries, especially health and personnel matters; '
        'accurate policy and regulatory interpretation; timely response (target: next business day); '
        'clear documentation for compliance and audit readiness.',

      'content',
        E'## Approach\nNIA HR Support uses **Resolve** to manage all staff HR inquiries with appropriate '
        'confidentiality and accuracy. Inquiries are triaged by sensitivity — routine questions handled '
        'by the HR Coordinator, complex or sensitive matters escalated to the HR and Finance Executive.\n\n'
        '### Key Steps\n1. Staff submits inquiry via Resolve\n2. Auto-acknowledgment sent\n'
        '3. HR team reviews category and sensitivity\n4. Assigned to Coordinator (routine) or Executive (complex)\n'
        '5. Research policy/carrier/regulation as needed\n6. Response via Resolve or phone for sensitive matters\n'
        '7. Ticket closed with documentation; survey sent\n8. Monthly metrics synced to Hub\n\n'
        '### Tools\n- **Resolve** — ticket management\n- **Tick** — leave balance cross-reference\n'
        '- Benefits carrier portals (IMRF, health/dental/vision)\n- NIA Personnel Policy Manual\n\n'
        '### Key Requirements\nConfidentiality, accurate interpretation, next-business-day response, '
        'documentation for compliance.'
    ),

    adli_deployment = jsonb_build_object(
      'teams', jsonb_build_array(
        'HR and Finance Executive — oversight, policy authority, complex and sensitive matters',
        'HR Coordinator — primary day-to-day ticket handling and policy research',
        'Administrative Assistant for HR — intake support, scheduling, routine acknowledgments',
        'All NIA staff — requesters (access via Resolve web portal)'
      ),

      'communication_plan',
        'Automated Resolve emails: (1) acknowledgment on ticket creation, (2) agent reply notification, '
        '(3) resolution confirmation with satisfaction survey link. '
        'For health-related or sensitive personnel matters, HR staff may call directly rather than reply '
        'in writing to protect confidentiality.',

      'training_approach',
        'All new NIA staff shown Resolve ticket submission during HR onboarding orientation, including '
        'what types of questions belong in Resolve vs. direct supervisor discussion. '
        'HR team cross-trained on benefits portals and policy manual navigation. '
        'Annual review of confidentiality protocols by HR staff.',

      'consistency_mechanisms',
        'Resolve enforces structured categories (Benefits, Leave, Policy, Payroll, Other). '
        'Sensitive inquiries can be marked for HR-only visibility. '
        'HR Coordinator and Executive coordinate daily on open items. '
        'Monthly Hub metrics flag resolution time drift before it becomes a pattern.',

      'content',
        E'## Deployment\nThe three-person HR team operates Resolve collaboratively, with clear role delineation '
        'between routine (Coordinator) and sensitive/complex (Executive) inquiries.\n\n'
        '### Team Roles\n- **HR and Finance Executive** — oversight, complex/sensitive matters\n'
        '- **HR Coordinator** — primary day-to-day ticket handling\n'
        '- **Administrative Assistant for HR** — intake support and scheduling\n'
        '- **All NIA staff** — requesters via Resolve portal\n\n'
        '### Communication\nAutomatic emails at each stage. Sensitive matters addressed by phone '
        'to protect confidentiality.\n\n'
        '### Consistency\nResolve''s structured categories and daily team coordination ensure no '
        'inquiry is missed. Monthly Hub metrics provide an early warning system for SLA drift.'
    ),

    adli_learning = jsonb_build_object(
      'metrics', jsonb_build_array(
        'Avg Resolution Time (target: ≤ 24 hours / next business day)',
        'Customer Satisfaction Score (target: ≥ 4.5 / 5.0)',
        'Monthly ticket volume',
        'Volume by category (Benefits, Leave, Policy, Payroll, Other)'
      ),

      'evaluation_methods',
        'Monthly metrics auto-synced from Resolve to Hub (Avg Resolution Time and Satisfaction for HR dept). '
        'Satisfaction survey sent on every ticket closure. '
        'HR team reviews category breakdowns monthly to identify recurring questions — '
        'high-volume categories indicate potential gaps in self-service resources.',

      'review_frequency',
        'Daily: HR Coordinator and Executive review open items. '
        'Monthly: metrics synced to Hub; team reviews resolution time, satisfaction, and category trends. '
        'Annual: full process and policy review; ticket trends inform annual Personnel Policy Manual updates.',

      'improvement_process',
        'Recurring inquiry categories trigger FAQ development or policy clarification documents. '
        'Satisfaction scores below 4.0 prompt individual case review and process debrief. '
        'Annual review of ticket trends feeds into the Personnel Policy Manual revision cycle. '
        'Process changes documented in Hub''s Improvements tab.',

      'content',
        E'## Learning\n### Metrics Tracked\n- Avg Resolution Time (target ≤ 24h)\n'
        '- Customer Satisfaction Score (target ≥ 4.5/5)\n- Monthly ticket volume\n'
        '- Volume by category (Benefits, Leave, Policy, Payroll, Other)\n\n'
        '### How We Evaluate\nEvery closed ticket triggers a satisfaction survey. Monthly metrics '
        'auto-sync to Hub. The HR team reviews category breakdowns to spot recurring inquiry patterns.\n\n'
        '### Review Cadence\n- **Daily:** Open item review\n- **Monthly:** Hub metric and category review\n'
        '- **Annual:** Full process review + policy manual update cycle\n\n'
        '### Improvement Loop\nHigh-volume categories → FAQ/self-service resources. '
        'Satisfaction below 4.0 → case review. Annual ticket trends → Personnel Policy updates.'
    ),

    adli_integration = jsonb_build_object(
      'strategic_goals', jsonb_build_array(
        'Workforce engagement — staff who get fast HR answers feel supported and valued',
        'Compliance — accurate FMLA, benefits, and policy guidance reduces legal exposure',
        'Retention — HR responsiveness is a key factor in staff satisfaction and stability'
      ),

      'mission_connection',
        'NIA''s mission depends on a stable, engaged workforce. HR Support directly enables '
        'Category 5 (Workforce) outcomes by ensuring staff have the information and support they '
        'need to participate fully in their work. Unresolved HR questions create distraction, '
        'anxiety, and potential compliance risk.',

      'related_processes', jsonb_build_array(
        'Technology Support (parallel internal service desk — shared Resolve platform)',
        'Employee Experience Survey (EE Survey captures workforce satisfaction, partly driven by HR responsiveness)',
        'Talent Management / Hiring (HR Support covers onboarding questions)',
        'Leave Management / Tick (HR inquiries about leave cross-reference Tick balances)'
      ),

      'standards_alignment',
        'Baldrige Category 5.2 (Workforce Climate) — creating a supportive environment that enables '
        'workforce engagement, wellbeing, and performance. '
        'HIPAA compliance for health-related employee inquiries. '
        'Illinois employment law compliance (105 ILCS, FMLA regulations, IMRF participation rules).',

      'content',
        E'## Integration\n### Strategic Goals\n- **Workforce engagement** — fast answers = staff feel supported\n'
        '- **Compliance** — accurate guidance reduces legal exposure\n'
        '- **Retention** — HR responsiveness is a key satisfaction driver\n\n'
        '### Mission Connection\nNIA''s mission depends on a stable, engaged workforce. '
        'Unresolved HR questions create distraction and compliance risk. HR Support is a direct '
        'enabler of Category 5 (Workforce) outcomes.\n\n'
        '### Related Processes\n- Technology Support (parallel service desk on Resolve)\n'
        '- Employee Experience Survey (EE Survey results reflect HR responsiveness)\n'
        '- Leave Management / Tick (leave balance cross-reference)\n'
        '- Talent Management / Hiring (onboarding questions)\n\n'
        '### Baldrige Alignment\nCategory 5.2 (Workforce Climate). Also: HIPAA compliance for '
        'health-related inquiries; Illinois employment law (FMLA, IMRF, 105 ILCS).'
    )

  WHERE id = v_hr_id;

END $$;
