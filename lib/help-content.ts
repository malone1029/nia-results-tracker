export interface HelpQuestion {
  question: string;
  answer: string;
  linkTo?: string;
}

export interface HelpSection {
  title: string;
  icon: string;
  questions: HelpQuestion[];
}

export const helpSections: HelpSection[] = [
  {
    title: "Getting Started",
    icon: "rocket",
    questions: [
      {
        question: "What is the NIA Excellence Hub?",
        answer: "The Hub is your central tool for managing organizational processes, tracking metrics, and preparing for Baldrige-based assessments. It connects to Asana for task management and uses AI to coach you through process improvement.",
      },
      {
        question: "What's the difference between admin and member roles?",
        answer: "Members can view and edit processes, log metrics, and use AI coaching. Admins can additionally manage users, run AI classifications, edit Baldrige criteria mappings, manage surveys across processes, and view all feedback submissions.",
        linkTo: "/settings",
      },
      {
        question: "How do I navigate the app?",
        answer: "Use the sidebar on the left to jump between pages. On mobile, tap the hamburger menu (three lines) in the top-left corner. The search bar at the top lets you quickly find any process, metric, or requirement by name.",
      },
      {
        question: "What does the Dashboard show me?",
        answer: "Your home page shows stat cards (My Readiness, Baldrige Ready, Needs Attention, Overdue Metrics), an ADLI overview, action items that need your attention, and a list of your processes. Select your name from the owner filter to see only your processes.",
        linkTo: "/",
      },
      {
        question: "What is the Task Hub on the Dashboard?",
        answer: "The Task Hub is your cross-process task queue. It groups tasks by urgency: red = overdue, orange = due soon, green = recently completed. You can mark tasks complete directly from the hub without opening a process page.",
        linkTo: "/",
      },
      {
        question: "How do I use Global Search (Cmd+K)?",
        answer: "Press Cmd+K (or Ctrl+K on Windows) to open the search palette. It searches across processes, metrics, and requirements by name. Click a result to jump directly to that page.",
      },
      {
        question: "How do I toggle Dark Mode?",
        answer: "Click the sun/moon icon in the sidebar or go to Settings. You can choose Light, Dark, or System (follows your device preference).",
        linkTo: "/settings",
      },
    ],
  },
  {
    title: "Processes",
    icon: "folder",
    questions: [
      {
        question: "How do I create a new process?",
        answer: "Go to Processes and click the 'New Process' button. You can create one manually, use AI to generate it from a description, or import from Asana if you have a connected account.",
        linkTo: "/processes",
      },
      {
        question: "What's the difference between Key and Support processes?",
        answer: "Key processes directly deliver value to NIA's primary customers — member school districts. Support processes keep the organization running internally but don't directly serve districts. See the 'Key vs. Support Processes' section in Help for a full breakdown with NIA examples.",
      },
      {
        question: "What are the tabs on a process detail page?",
        answer: "Each process has 5 tabs: Overview (health score, ADLI snapshot, metrics, surveys), Documentation (charter + ADLI sections), Process Map (visual flowchart), Tasks (PDCA-organized action items), and Improvements (journal entries + change history).",
      },
      {
        question: "What is the Improvement Stepper?",
        answer: "The 6-step guided cycle at the top of Asana-linked processes: Start, Charter Review, ADLI Assessment, Deep Dive, Task Generation, and Export. Each step has an action button that opens AI coaching with a step-specific prompt to guide you through the improvement process.",
      },
      {
        question: "How do I edit a process?",
        answer: "On any process detail page, click the pencil icon next to a section header or use the Edit button in the page header. The edit page lets you modify the charter, ADLI sections, stakeholders, and other details.",
      },
      {
        question: "What is a Process Map?",
        answer: "A visual flowchart showing your process steps, decision points, and outputs. The AI can generate one automatically based on your charter and ADLI documentation. You can download it as SVG or PNG.",
      },
      {
        question: "How do I use drag-and-drop in the task list?",
        answer: "On any process's Tasks tab, you can drag tasks between PDCA sections (Plan, Execute, Evaluate, Improve) to reclassify them. The new section auto-saves immediately. This helps you organize work as it moves through the improvement cycle.",
      },
      {
        question: "What is the My Tasks page?",
        answer: "My Tasks (/my-tasks) shows all tasks assigned to you across every process, in one place. Tasks are grouped by process name and can be filtered by search, priority (high/medium/low), and status (active/completed/overdue). Click any task to open its detail panel.",
        linkTo: "/my-tasks",
      },
      {
        question: "How do task priorities work?",
        answer: "Each task has a priority level: high (red dot), medium (default), or low. Set priority when creating a task or change it in the task detail panel. The AI coach also assigns priorities when generating tasks. Use the filter bar to focus on high-priority items.",
      },
      {
        question: "What can I do in the task detail panel?",
        answer: "Click any task to open a slide-out detail panel. From there you can edit the title, description, due date, priority, and assignee. You can also add comments, view the activity log, and delete the task. Changes save automatically.",
      },
      {
        question: "How do task comments and the activity log work?",
        answer: "In the task detail panel, scroll to the Comments section to leave notes for your team. The Activity Log below it automatically records all changes: creation, completion, priority changes, reassignment, and comments — with timestamps and who made each change.",
      },
    ],
  },
  {
    title: "Key vs. Support Processes",
    icon: "book-open",
    questions: [
      {
        question: "What is a Key process according to Baldrige?",
        answer: "A Key process is one that directly creates value for your primary external customers — for NIA, that means the member school districts you serve. Baldrige defines Key processes as the work processes most critical to your organization delivering on its mission. If a district asked 'what does NIA do for us?', every honest answer would name a Key process. Examples at NIA: Special Education Cooperative Services, Professional Development, Technology Support, Fiscal Services for Districts.",
      },
      {
        question: "What is a Support process according to Baldrige?",
        answer: "A Support process is necessary for daily operations but doesn't directly deliver value to external customers. It enables Key processes to function. Support processes serve internal customers — NIA staff, leadership, or the organization itself. Examples at NIA: HR & Hiring, IT Infrastructure, Policy Management, Budget & Finance (internal), Facilities Management, Process Design & Improvement, Performance Measurement & Analysis. Notice that last two: even the Excellence Hub's own internal processes are Support, because they serve NIA's staff — not member districts directly.",
      },
      {
        question: "How do I decide if a process is Key or Support?",
        answer: "Ask yourself this single question: 'If this process stopped working tomorrow, would a member school district notice or be harmed?' If yes — it's Key. If only NIA staff would notice — it's Support. A second check: Key processes usually appear in your service catalog or contract with member districts. Support processes rarely do. When in doubt, lean toward Support. It's better to under-classify and upgrade later than to dilute your Key process pool with processes that don't get Baldrige-level scrutiny.",
      },
      {
        question: "Can a process be both Key and Support depending on context?",
        answer: "Yes — context matters. A process can be Key for one category of customer and Support for another. For example, NIA's Payroll process is Support (it serves internal staff), but a district's payroll processing service that NIA administers on their behalf would be Key (it directly serves districts). The test is always: who is the primary beneficiary, and are they an external customer? When a process genuinely serves both, classify it based on its primary purpose and largest stakeholder impact.",
      },
      {
        question: "Why does the classification affect our Baldrige score?",
        answer: "Key processes count 2x in the Hub's readiness score — meaning a Key process with a low health score hurts your org average much more than a low-scoring Support process. More importantly, Baldrige examiners focus their scoring energy on Key processes. They expect: (1) thorough ADLI documentation across all 4 dimensions, (2) metrics with targets and LeTCI data, (3) strong Category 7 results that trace back to the Key process. A Support process without strong results won't hurt you much. A Key process without them will.",
      },
      {
        question: "What are NIA's Key processes?",
        answer: "NIA's Key processes are those in Baldrige Categories 6.1 and 6.2 that directly deliver cooperative services to member districts. They typically live in categories like Special Education (SPED), Professional Learning, Technology Services, and Fiscal/Business Services. If a process has a signed service agreement or purchase of service with member districts, it's almost certainly Key. The Command Center's Key Process Classifier tool uses AI to suggest classifications based on your process charter — a good starting point when you're unsure.",
        linkTo: "/command-center",
      },
      {
        question: "Can a process change classification over time?",
        answer: "Yes, and it should be revisited annually. A process that starts as internal infrastructure (Support) can become Key if NIA begins offering it as a service to districts. The reverse can also happen — a Key process might be retired from the service catalog and become an internal coordination function. Review classifications during your annual Baldrige readiness cycle and whenever NIA's service offerings change significantly. Update the Hub accordingly so your readiness score reflects the current reality.",
      },
    ],
  },
  {
    title: "AI Coaching",
    icon: "sparkle",
    questions: [
      {
        question: "How do I use the AI coach?",
        answer: "On any process detail page, click 'Ask AI' to open the coaching panel. The AI analyzes your process documentation and suggests improvements. You can ask it questions, request assessments, or have it generate content like task lists and process maps.",
      },
      {
        question: "What does 'Apply This' do on an AI suggestion?",
        answer: "When the AI suggests changes, 'Apply This' writes the suggestion directly into your process fields (like charter, ADLI sections, etc.). The original content is saved in the Improvements tab so you can always see what changed.",
      },
      {
        question: "Can the AI generate tasks for my process?",
        answer: "Yes — during the Task Generation step, the AI analyzes your ADLI documentation and creates specific, actionable tasks organized by PDCA phase (Plan, Execute, Evaluate, Improve) with priority levels. Tasks auto-sync to Asana when the process is linked.",
      },
      {
        question: "Why does the AI sometimes take a while to respond?",
        answer: "The AI reads your full process documentation, metrics, survey data, and Baldrige connections before responding. Longer processes with more data take more time to analyze. If it seems stuck, try refreshing the page.",
      },
    ],
  },
  {
    title: "Metrics & Data",
    icon: "heart",
    questions: [
      {
        question: "How do I log a data point?",
        answer: "Go to Log Data in the sidebar, select a metric from the dropdown, enter the date, value, and optional analysis note. You can also click the 'Log' button next to overdue metrics on the Dashboard.",
        linkTo: "/log",
      },
      {
        question: "What does 'overdue' mean for a metric?",
        answer: "A metric is overdue when it hasn't been updated within its expected cadence — for example, a monthly metric with no data point in the last 30 days. Overdue metrics appear on your Dashboard action items.",
      },
      {
        question: "How do I link a metric to a process?",
        answer: "On a process detail page (Overview tab), click 'Link Metric' and select from your existing metrics. You can also use the AI coach, which may suggest relevant metrics during an assessment.",
      },
      {
        question: "How do I bulk-edit metrics?",
        answer: "Go to Data Health, click 'Edit Metrics', then use checkboxes to select metrics. The floating toolbar lets you change cadence, unit, target, or other fields for all selected metrics at once. Admins can also bulk-delete.",
        linkTo: "/data-health",
      },
      {
        question: "What are metric cadences?",
        answer: "Cadence is how often a metric should be updated: daily, weekly, monthly, quarterly, semi-annually, or annually. The system uses this to determine when a metric is due or overdue for a new data point.",
      },
    ],
  },
  {
    title: "Surveys",
    icon: "clipboard-list",
    questions: [
      {
        question: "How do I create a survey?",
        answer: "On a process detail page (Overview tab), scroll to the Surveys section and click 'Create Survey'. Add questions (rating scales, yes/no, or open text), optionally link each question to a metric, then save.",
      },
      {
        question: "What is a survey 'wave'?",
        answer: "Each deployment of a survey is called a wave. A wave has its own unique share link and collects its own set of responses. When you close a wave, the results are locked in and any linked metrics automatically get new data points.",
      },
      {
        question: "How do I share a survey?",
        answer: "Deploy a survey to create a wave, then share the link or QR code. Survey responses are anonymous and don't require a login — anyone with the link can respond.",
      },
      {
        question: "How do survey results become metrics?",
        answer: "When you close a wave, the system automatically creates metric entries: rating questions generate an average score, and yes/no questions generate a percentage. This only works for questions that are linked to a metric.",
      },
    ],
  },
  {
    title: "Asana Integration",
    icon: "link",
    questions: [
      {
        question: "How do I connect my Asana account?",
        answer: "Go to Settings and click 'Connect with Asana' in the Asana Connection section. You'll be redirected to Asana to authorize the Hub. Each team member connects their own Asana account.",
        linkTo: "/settings",
      },
      {
        question: "How do I import a project from Asana?",
        answer: "Go to Processes, click 'Import from Asana', and select a project. The Hub imports the project overview, sections, and task structure. You can also use 'Select Multiple' for bulk import.",
        linkTo: "/processes/import",
      },
      {
        question: "What does 'Sync to Asana' do?",
        answer: "It updates the Asana project with your Hub changes: charter goes to the project overview, ADLI sections become documentation tasks, and improvement journal entries become Asana tasks. It also brings back any changes made in Asana.",
      },
      {
        question: "Why did my Asana sync show a warning?",
        answer: "Warnings usually mean the Hub couldn't update the project description (requires Editor or Owner access in Asana) but still synced tasks successfully. Ask your Asana workspace admin to upgrade your project permissions if needed.",
      },
    ],
  },
  {
    title: "Baldrige & Excellence Builder",
    icon: "book-open",
    questions: [
      {
        question: "What is the Baldrige Framework?",
        answer: "The Baldrige Performance Excellence Framework is a systematic approach to organizational improvement used by thousands of organizations. It evaluates 7 categories: Leadership, Strategy, Customers, Measurement, Workforce, Operations, and Results.",
      },
      {
        question: "What is the Criteria Map?",
        answer: "The Criteria Map shows how your processes align to Baldrige questions. Each Baldrige item has specific questions that processes should address. The AI can auto-suggest mappings, or admins can manually link them.",
        linkTo: "/criteria",
      },
      {
        question: "What is Gap Analysis?",
        answer: "Gap Analysis identifies Baldrige questions that have no processes mapped to them — these are blind spots in your organization's coverage. Questions are sorted by point value to help you prioritize.",
        linkTo: "/criteria/gaps",
      },
      {
        question: "What are Application Drafts?",
        answer: "Application Drafts is where admins write Excellence Builder narratives for each Baldrige item. The AI can help generate draft text based on your process documentation and mapped questions. You can export everything to a Word document.",
        linkTo: "/application",
      },
      {
        question: "What does 'Key vs Support' classification mean for Baldrige?",
        answer: "Baldrige examiners give extra scrutiny to Key processes — they expect thorough ADLI documentation, linked metrics with targets, and strong Category 7 results tied back to them. Misclassifying a process as Key when it's really Support inflates your process count and dilutes examiner focus. See the 'Key vs. Support Processes' section in Help for the full decision framework.",
      },
    ],
  },
  {
    title: "Health & Readiness",
    icon: "shield-check",
    questions: [
      {
        question: "What is a Health Score?",
        answer: "A 0-100 score measuring how well-documented and maintained a process is, across 5 dimensions: Documentation (25 pts), Maturity (25 pts), Measurement (20 pts), Operations (15 pts), and Freshness (15 pts). 80+ means Baldrige Ready.",
      },
      {
        question: "What do the health score levels mean?",
        answer: "Baldrige Ready (80+): well-documented, measured, and current. On Track (60-79): solid foundation, some gaps. Developing (40-59): basic documentation exists, needs work. Getting Started (0-39): minimal documentation or data.",
      },
      {
        question: "What is the Readiness Dashboard?",
        answer: "An org-wide view showing your overall Baldrige readiness score, category breakdown, dimension gap analysis, and top 5 next actions. Filter by owner to compare your personal readiness against the organization.",
        linkTo: "/readiness",
      },
      {
        question: "How is the org readiness score calculated?",
        answer: "It's the weighted average of all process health scores. Key processes count 2x because they carry more weight in Baldrige evaluations. The score updates automatically as you improve your processes.",
      },
      {
        question: "What does 'Needs Attention' mean?",
        answer: "A process needs attention if its health score is below 40 OR it hasn't been updated in over 60 days. Check the Dashboard or Readiness page to see which processes need work.",
      },
    ],
  },
  {
    title: "Advanced Features",
    icon: "beaker",
    questions: [
      {
        question: "What is ADLI Insights?",
        answer: "ADLI Insights shows your process maturity across four Baldrige dimensions: Approach (how well-defined), Deployment (how widely used), Learning (how you improve), and Integration (how it connects to goals). Scores are generated by AI assessments. View category groupings and a radar chart on the ADLI Insights page.",
        linkTo: "/adli-insights",
      },
      {
        question: "What is LeTCI?",
        answer: "LeTCI measures four elements Baldrige examiners look for in your metrics: Level (data exists), Trend (3+ data points showing direction), Comparison (benchmark set), and Integration (linked to a key requirement). Each element scores 0 or 1, so a perfect LeTCI score is 4/4.",
        linkTo: "/letci",
      },
      {
        question: "What is the Improvement Journal?",
        answer: "The Improvement Journal tracks changes you make to a process over time. Each entry captures what changed, before/after snapshots, and impact notes. Completed journal entries count toward your process health score in the Freshness dimension.",
      },
      {
        question: "How do Process Maps work?",
        answer: "Process Maps are AI-generated Mermaid flowcharts that visualize your process steps, decision points, and outputs. On any process's Process Map tab, click 'Generate Process Map' to create one. You can refine it by asking the AI for changes, regenerate from scratch, or download as SVG or PNG.",
      },
    ],
  },
  {
    title: "Strategic Plan & Balanced Scorecard",
    icon: "shield-check",
    questions: [
      {
        question: "What is the Strategic Plan page?",
        answer: "The Strategic Plan page shows NIA's FY26 Balanced Scorecard — 10 strategic objectives organized into four perspectives: Financial Stability, Organizational Capacity, Internal Processes, and Customer Satisfaction. It tracks live progress using existing Hub metrics and auto-computed data.",
        linkTo: "/strategy",
      },
      {
        question: "How is progress tracked for each objective?",
        answer: "Objectives use one of three methods: (1) Metric — pulls the latest value from a linked Hub metric automatically (e.g. Studer satisfaction scores update when survey data is entered); (2) ADLI Threshold — auto-counts processes that have achieved an ADLI score of 70 or higher; (3) Manual — an admin enters progress directly for goals without a linked metric (e.g. budget surplus).",
      },
      {
        question: "What do the green, yellow, and red dots mean?",
        answer: "Green means the objective is at or above its target. Yellow means it's within 10% below target — close but not there yet. Red means it's more than 10% below target and needs attention. Gray means no data is available yet.",
      },
      {
        question: "How do I link my process to a strategic objective?",
        answer: "On any process detail page, scroll to the Strategic Objectives section in the Overview tab. Check the box next to each objective your process supports. This helps NIA see which processes are driving strategic goals and shows coverage gaps.",
        linkTo: "/processes",
      },
      {
        question: "What is the ADLI ≥ 70 objective?",
        answer: "One of NIA's FY26 strategic goals is to have 20 or more processes achieve an ADLI overall score of 70 or higher by June 2026. This score is auto-computed — every time an AI assessment runs on a process, the count updates automatically. A score of 70 means a process has a systematic approach that is well-deployed and shows evidence of learning cycles.",
      },
    ],
  },
];
