-- Migration: Workflow tab content for Technology Support and HR Support
-- Populates: inputs, steps, outputs, quality_controls, flow_data (React Flow), and markdown content.

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
  -- TECHNOLOGY SUPPORT — Workflow
  -- ══════════════════════════════════════════════════════════════

  UPDATE processes
  SET workflow = jsonb_build_object(

    'inputs', jsonb_build_array(
      'Staff technology request or issue description',
      'Hardware or software failure report',
      'New staff device setup request (onboarding)',
      'System or application access request'
    ),

    'steps', jsonb_build_array(
      jsonb_build_object(
        'responsible', 'Staff (Requester)',
        'action',      'Submit technology request via Resolve (web portal or email-to-ticket)',
        'output',      'Ticket created with unique number and auto-assigned category',
        'timing',      'As needed'
      ),
      jsonb_build_object(
        'responsible', 'Resolve System',
        'action',      'Send auto-acknowledgment email to submitter with ticket number',
        'output',      'Email confirmation delivered to staff',
        'timing',      'Immediate (automated)'
      ),
      jsonb_build_object(
        'responsible', 'Dispatcher',
        'action',      'Review incoming ticket; set or confirm priority (low / normal / high / urgent) and assign to tech agent',
        'output',      'Ticket priority set; agent assigned',
        'timing',      'Within 1 hour of submission'
      ),
      jsonb_build_object(
        'responsible', 'Tech Agent',
        'action',      'Acknowledge assignment; contact staff if needed to clarify; communicate expected resolution timeline',
        'output',      'Staff informed of ETA',
        'timing',      'Same day for urgent/high; next business day for normal/low'
      ),
      jsonb_build_object(
        'responsible', 'Tech Agent',
        'action',      'Diagnose root cause; implement resolution (remote or on-site as needed)',
        'output',      'Technology issue resolved',
        'timing',      'Per priority SLA: urgent = same day, normal = next business day'
      ),
      jsonb_build_object(
        'responsible', 'Tech Agent',
        'action',      'Document resolution steps, root cause, and any follow-up actions required',
        'output',      'Ticket record updated with resolution notes',
        'timing',      'Before closing ticket'
      ),
      jsonb_build_object(
        'responsible', 'Tech Agent / Resolve System',
        'action',      'Close ticket; Resolve automatically sends satisfaction survey (1–5 stars + optional comment) to staff',
        'output',      'Closed ticket record; survey email delivered',
        'timing',      'Immediate on closure'
      ),
      jsonb_build_object(
        'responsible', 'Admin / Tech Staff',
        'action',      'Monthly: use /resolve page in Hub to preview and sync department metrics (resolution time, satisfaction)',
        'output',      'Hub entries updated for Technology Support metrics',
        'timing',      'First week of each month, for prior month'
      )
    ),

    'outputs', jsonb_build_array(
      'Resolved technology issue with documented steps',
      'Closed ticket record in Resolve (full audit trail)',
      'Staff satisfaction survey response',
      'Monthly metric entries in NIA Excellence Hub'
    ),

    'quality_controls', jsonb_build_array(
      'Dispatcher reviews open ticket queue daily — any ticket without a response in >4 hours flagged',
      'Priority levels (low / normal / high / urgent) enforce differentiated response time expectations',
      'Satisfaction survey on every closed ticket — responses below 4/5 trigger follow-up review',
      'Monthly Hub metrics (avg resolution time, avg satisfaction) flag systemic SLA drift before it becomes a pattern',
      'Recurring issue types trigger knowledge base article creation to enable faster future resolution'
    ),

    'content', E'## Workflow: Technology Support\n\n'
      '### Inputs\n- Staff technology request or issue\n- Hardware/software failure report\n'
      '- New staff device setup (onboarding)\n- System/application access request\n\n'
      '### Key Steps\n'
      '1. **Staff** submits request via Resolve\n'
      '2. **Resolve** sends auto-acknowledgment with ticket number\n'
      '3. **Dispatcher** triages and assigns priority + agent (within 1 hour)\n'
      '4. **Tech Agent** contacts staff, communicates ETA\n'
      '5. **Tech Agent** diagnoses and resolves issue (same day for urgent; next-day for standard)\n'
      '6. **Tech Agent** documents resolution and root cause\n'
      '7. **Tech Agent** closes ticket; survey auto-sent to staff\n'
      '8. **Admin** syncs monthly metrics to Hub (/resolve page)\n\n'
      '### Outputs\n- Resolved issue with documented steps\n- Closed ticket in Resolve\n'
      '- Satisfaction survey response\n- Monthly Hub metric entries\n\n'
      '### Quality Controls\n- Daily open queue review by dispatcher\n'
      '- Priority levels enforce differentiated SLA targets\n'
      '- Satisfaction survey on every closed ticket\n'
      '- Monthly Hub metrics flag resolution time drift',

    'flow_data', jsonb_build_object(
      'nodes', jsonb_build_array(
        jsonb_build_object('id', 'n_start',    'type', 'start',    'label', 'Request Received'),
        jsonb_build_object('id', 'n_input',    'type', 'input',    'label', 'Staff ticket via Resolve'),
        jsonb_build_object('id', 'n_triage',   'type', 'step',     'label', 'Auto-Ack + Triage',
                           'responsible', 'Dispatcher'),
        jsonb_build_object('id', 'n_priority', 'type', 'decision', 'label', 'Priority?'),
        jsonb_build_object('id', 'n_urgent',   'type', 'step',     'label', 'Same-Day Response',
                           'responsible', 'Tech Agent',
                           'notes', 'Urgent or High priority tickets'),
        jsonb_build_object('id', 'n_standard', 'type', 'step',     'label', 'Next-Day Response',
                           'responsible', 'Tech Agent',
                           'notes', 'Normal or Low priority tickets'),
        jsonb_build_object('id', 'n_resolve',  'type', 'step',     'label', 'Diagnose & Resolve',
                           'responsible', 'Tech Agent'),
        jsonb_build_object('id', 'n_document', 'type', 'step',     'label', 'Document & Close',
                           'responsible', 'Tech Agent'),
        jsonb_build_object('id', 'n_output',   'type', 'output',   'label', 'Resolution + Survey Sent'),
        jsonb_build_object('id', 'n_end',      'type', 'end',      'label', 'Ticket Complete')
      ),
      'edges', jsonb_build_array(
        jsonb_build_object('id', 'e1', 'source', 'n_start',    'target', 'n_input'),
        jsonb_build_object('id', 'e2', 'source', 'n_input',    'target', 'n_triage'),
        jsonb_build_object('id', 'e3', 'source', 'n_triage',   'target', 'n_priority'),
        jsonb_build_object('id', 'e4', 'source', 'n_priority', 'target', 'n_urgent',   'label', 'Urgent/High'),
        jsonb_build_object('id', 'e5', 'source', 'n_priority', 'target', 'n_standard', 'label', 'Normal/Low'),
        jsonb_build_object('id', 'e6', 'source', 'n_urgent',   'target', 'n_resolve'),
        jsonb_build_object('id', 'e7', 'source', 'n_standard', 'target', 'n_resolve'),
        jsonb_build_object('id', 'e8', 'source', 'n_resolve',  'target', 'n_document'),
        jsonb_build_object('id', 'e9', 'source', 'n_document', 'target', 'n_output'),
        jsonb_build_object('id', 'e10','source', 'n_output',   'target', 'n_end')
      )
    )

  )
  WHERE id = v_tech_id;

  -- ══════════════════════════════════════════════════════════════
  -- HR SUPPORT — Workflow
  -- ══════════════════════════════════════════════════════════════

  UPDATE processes
  SET workflow = jsonb_build_object(

    'inputs', jsonb_build_array(
      'Staff HR inquiry (benefits, leave, policy, payroll, or other)',
      'FMLA or leave of absence request',
      'Benefits enrollment or change question',
      'Personnel policy interpretation request',
      'Payroll discrepancy or question'
    ),

    'steps', jsonb_build_array(
      jsonb_build_object(
        'responsible', 'Staff (Requester)',
        'action',      'Submit HR inquiry via Resolve web portal; select appropriate category (Benefits, Leave, Policy, Payroll, Other)',
        'output',      'Ticket created with category and unique number',
        'timing',      'As needed'
      ),
      jsonb_build_object(
        'responsible', 'Resolve System',
        'action',      'Send auto-acknowledgment email to submitter with ticket number',
        'output',      'Confirmation email delivered',
        'timing',      'Immediate (automated)'
      ),
      jsonb_build_object(
        'responsible', 'HR Team',
        'action',      'Review incoming inquiry; assess category and sensitivity level; assign to appropriate HR staff',
        'output',      'Inquiry categorized; assigned to Coordinator (routine) or Executive (sensitive/complex)',
        'timing',      'Same day as submission'
      ),
      jsonb_build_object(
        'responsible', 'HR and Finance Executive',
        'action',      'Handle sensitive, complex, or legally significant inquiries; consult policy manual, IMRF, or legal counsel as needed',
        'output',      'Authoritative guidance prepared',
        'timing',      'Next business day target'
      ),
      jsonb_build_object(
        'responsible', 'HR Coordinator',
        'action',      'Handle routine inquiries; consult NIA policy manual, benefits portals (IMRF, insurance carriers), or Tick (leave balances)',
        'output',      'Accurate response prepared',
        'timing',      'Next business day target'
      ),
      jsonb_build_object(
        'responsible', 'HR Staff',
        'action',      'Respond to staff via Resolve message thread; use phone call for health-related or sensitive matters (HIPAA)',
        'output',      'Response delivered to staff',
        'timing',      'Per assignment SLA'
      ),
      jsonb_build_object(
        'responsible', 'HR Staff',
        'action',      'Document resolution; note any follow-up actions, policy references, or escalation details',
        'output',      'Complete ticket record in Resolve',
        'timing',      'Before closing ticket'
      ),
      jsonb_build_object(
        'responsible', 'HR Staff / Resolve System',
        'action',      'Close ticket; Resolve automatically sends satisfaction survey (1–5 stars + optional comment)',
        'output',      'Closed ticket; survey email delivered to staff',
        'timing',      'Immediate on closure'
      ),
      jsonb_build_object(
        'responsible', 'HR Coordinator / Admin',
        'action',      'Monthly: use /resolve page in Hub to preview and sync department metrics (resolution time, satisfaction)',
        'output',      'Hub entries updated for HR Support metrics',
        'timing',      'First week of each month, for prior month'
      )
    ),

    'outputs', jsonb_build_array(
      'Accurate, confidential HR guidance delivered to staff',
      'Closed ticket record in Resolve (full audit trail)',
      'Staff satisfaction survey response',
      'Monthly metric entries in NIA Excellence Hub',
      'Policy clarification documentation (for high-volume inquiry types)'
    ),

    'quality_controls', jsonb_build_array(
      'HR Coordinator and Executive coordinate daily on open items to ensure no inquiry is missed',
      'Sensitivity triage ensures health-related and personnel matters reach HR Executive (not just Coordinator)',
      'Phone calls used for HIPAA-relevant health inquiries — not written in Resolve thread',
      'Satisfaction survey on every closed ticket; scores below 4/5 trigger case-level review',
      'Monthly Hub metrics (resolution time, satisfaction) flag systemic SLA drift',
      'Annual review of ticket category trends feeds Personnel Policy Manual update cycle'
    ),

    'content', E'## Workflow: HR Support\n\n'
      '### Inputs\n- Staff HR inquiry (benefits, leave, policy, payroll, or other)\n'
      '- FMLA or leave of absence request\n- Benefits enrollment or change question\n'
      '- Policy interpretation request\n- Payroll discrepancy\n\n'
      '### Key Steps\n'
      '1. **Staff** submits inquiry via Resolve (selects category)\n'
      '2. **Resolve** sends auto-acknowledgment\n'
      '3. **HR Team** triages sensitivity and assigns (Coordinator = routine; Executive = sensitive/complex)\n'
      '4. **HR Executive** handles sensitive/complex matters (FMLA, legal, personnel)\n'
      '4. **HR Coordinator** handles routine questions (benefits, policy lookup, leave balances)\n'
      '5. **HR Staff** responds via Resolve thread — phone call for HIPAA-sensitive matters\n'
      '6. **HR Staff** documents resolution and closes ticket\n'
      '7. **Resolve** auto-sends satisfaction survey\n'
      '8. **HR Coordinator** syncs monthly metrics to Hub (/resolve page)\n\n'
      '### Outputs\n- Accurate HR guidance delivered\n- Closed ticket in Resolve\n'
      '- Satisfaction survey response\n- Monthly Hub metric entries\n\n'
      '### Quality Controls\n- Daily open item coordination between Coordinator and Executive\n'
      '- Sensitivity triage protects staff confidentiality\n'
      '- HIPAA-sensitive inquiries handled by phone, not in writing\n'
      '- Monthly Hub metrics flag resolution drift\n'
      '- Annual ticket trend review feeds policy manual updates',

    'flow_data', jsonb_build_object(
      'nodes', jsonb_build_array(
        jsonb_build_object('id', 'n_start',       'type', 'start',    'label', 'Inquiry Submitted'),
        jsonb_build_object('id', 'n_input',       'type', 'input',    'label', 'Benefits / Leave / Policy / Payroll'),
        jsonb_build_object('id', 'n_triage',      'type', 'step',     'label', 'Acknowledge & Triage',
                           'responsible', 'HR Team'),
        jsonb_build_object('id', 'n_sensitive',   'type', 'decision', 'label', 'Sensitive or Complex?'),
        jsonb_build_object('id', 'n_executive',   'type', 'step',     'label', 'HR Executive Handles',
                           'responsible', 'HR & Finance Executive',
                           'notes', 'FMLA, health, personnel, legal'),
        jsonb_build_object('id', 'n_coordinator', 'type', 'step',     'label', 'HR Coordinator Handles',
                           'responsible', 'HR Coordinator',
                           'notes', 'Benefits, policy lookup, leave balances'),
        jsonb_build_object('id', 'n_respond',     'type', 'step',     'label', 'Respond to Staff',
                           'responsible', 'HR Staff',
                           'notes', 'Resolve thread or phone for HIPAA matters'),
        jsonb_build_object('id', 'n_close',       'type', 'step',     'label', 'Document & Close',
                           'responsible', 'HR Staff'),
        jsonb_build_object('id', 'n_output',      'type', 'output',   'label', 'Resolution + Survey Sent'),
        jsonb_build_object('id', 'n_end',         'type', 'end',      'label', 'Inquiry Complete')
      ),
      'edges', jsonb_build_array(
        jsonb_build_object('id', 'e1', 'source', 'n_start',     'target', 'n_input'),
        jsonb_build_object('id', 'e2', 'source', 'n_input',     'target', 'n_triage'),
        jsonb_build_object('id', 'e3', 'source', 'n_triage',    'target', 'n_sensitive'),
        jsonb_build_object('id', 'e4', 'source', 'n_sensitive', 'target', 'n_executive',   'label', 'Yes — Sensitive'),
        jsonb_build_object('id', 'e5', 'source', 'n_sensitive', 'target', 'n_coordinator', 'label', 'No — Routine'),
        jsonb_build_object('id', 'e6', 'source', 'n_executive',   'target', 'n_respond'),
        jsonb_build_object('id', 'e7', 'source', 'n_coordinator', 'target', 'n_respond'),
        jsonb_build_object('id', 'e8', 'source', 'n_respond',   'target', 'n_close'),
        jsonb_build_object('id', 'e9', 'source', 'n_close',     'target', 'n_output'),
        jsonb_build_object('id', 'e10','source', 'n_output',    'target', 'n_end')
      )
    )

  )
  WHERE id = v_hr_id;

END $$;
