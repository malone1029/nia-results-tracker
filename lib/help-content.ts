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
        answer: "Key processes directly serve your organization's mission — they're what you exist to do. Support processes enable Key ones to work (like IT, HR, or facilities). Key processes count 2x in the readiness score because they get extra scrutiny from Baldrige examiners.",
        linkTo: "/classifications",
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
        answer: "Yes — during the Task Generation step, the AI analyzes your ADLI documentation and creates specific, actionable tasks organized by PDCA phase (Plan, Do, Check, Act). These tasks can then be exported to Asana.",
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
        answer: "Baldrige examiners give extra scrutiny to Key processes. Correctly classifying processes ensures the right ones get thorough documentation and strong results data. The AI can suggest classifications with rationale.",
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
];
