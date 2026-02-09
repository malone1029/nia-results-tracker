// NIA Results Tracker - Database Seed Script (US-003)
// Reads metric definitions from Obsidian vault data and populates Supabase
// Run with: npx tsx seed.ts

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://wjunuszutieidtvxsupq.supabase.co",
  "sb_publishable_lICIzP1E6jMZW2AZnsi5Yw_q0XBZhSm"
);

// Helper: upsert a process and return its ID
async function upsertProcess(
  categoryId: number,
  name: string,
  description: string,
  baldrigeItem: string | null = null
): Promise<number> {
  // Check if exists
  const { data: existing } = await supabase
    .from("processes")
    .select("id")
    .eq("category_id", categoryId)
    .eq("name", name)
    .single();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("processes")
    .insert({ category_id: categoryId, name, description, baldrige_item: baldrigeItem })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to insert process "${name}": ${error.message}`);
  return data!.id;
}

// Helper: upsert a metric and link it to a process via junction table
async function upsertMetric(
  processId: number,
  name: string,
  opts: {
    description?: string;
    cadence: string;
    target_value?: number | null;
    comparison_value?: number | null;
    comparison_source?: string | null;
    data_source?: string;
    collection_method?: string;
    unit?: string;
    is_higher_better?: boolean;
  }
): Promise<number> {
  const { data: existing } = await supabase
    .from("metrics")
    .select("id")
    .eq("name", name)
    .single();

  if (existing) {
    // Ensure junction link exists
    await supabase.from("metric_processes").upsert(
      { metric_id: existing.id, process_id: processId },
      { onConflict: "metric_id,process_id" }
    );
    return existing.id;
  }

  const { data, error } = await supabase
    .from("metrics")
    .insert({
      name,
      description: opts.description || null,
      cadence: opts.cadence,
      target_value: opts.target_value ?? null,
      comparison_value: opts.comparison_value ?? null,
      comparison_source: opts.comparison_source ?? null,
      data_source: opts.data_source || null,
      collection_method: opts.collection_method || null,
      unit: opts.unit || "%",
      is_higher_better: opts.is_higher_better ?? true,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to insert metric "${name}": ${error.message}`);

  // Create junction link
  await supabase.from("metric_processes").insert({
    metric_id: data!.id,
    process_id: processId,
  });

  return data!.id;
}

// Helper: insert entry if it doesn't already exist for that metric+date
async function seedEntry(
  metricId: number,
  value: number,
  date: string,
  noteAnalysis?: string
) {
  const { data: existing } = await supabase
    .from("entries")
    .select("id")
    .eq("metric_id", metricId)
    .eq("date", date)
    .single();

  if (existing) return; // Skip duplicates

  const { error } = await supabase.from("entries").insert({
    metric_id: metricId,
    value,
    date,
    note_analysis: noteAnalysis || null,
  });

  if (error) console.warn(`  Warning: entry for metric ${metricId} on ${date}: ${error.message}`);
}

async function seed() {
  console.log("Starting NIA Results Tracker seed...\n");

  // Get category IDs
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("sort_order");

  if (!categories || categories.length === 0) {
    console.error("No categories found! Run the schema SQL first.");
    return;
  }

  const catMap: Record<string, number> = {};
  for (const cat of categories) {
    catMap[cat.name] = cat.id;
  }

  console.log("Categories loaded:", Object.keys(catMap).join(", "));

  // ============================================================
  // CATEGORY 1: LEADERSHIP
  // ============================================================
  console.log("\n--- Category 1: Leadership ---");

  // Process: Strategic Direction
  const strategicDirection = await upsertProcess(
    catMap["1-Leadership"],
    "Strategic Direction Process",
    "Setting and communicating organizational direction through the Six Questions framework",
    "1.1"
  );
  console.log("  Process: Strategic Direction");

  const eeOverall = await upsertMetric(strategicDirection, "Employee Experience Overall Mean", {
    cadence: "semi-annual",
    target_value: 4.50,
    data_source: "Studer EE Survey",
    collection_method: "Semi-annual survey",
    unit: "score",
  });
  await seedEntry(eeOverall, 4.62, "2024-11-01", "Fall 2024 administration");
  await seedEntry(eeOverall, 4.63, "2025-04-01", "Spring 2025 administration");
  await seedEntry(eeOverall, 4.61, "2025-11-01", "Fall 2025 administration");

  const eeTopBox = await upsertMetric(strategicDirection, "Employee Experience Top Box %", {
    cadence: "semi-annual",
    target_value: 70,
    data_source: "Studer EE Survey",
    collection_method: "Semi-annual survey",
    unit: "%",
  });
  await seedEntry(eeTopBox, 69.79, "2024-11-01", "Fall 2024");
  await seedEntry(eeTopBox, 70.25, "2025-04-01", "Spring 2025");
  await seedEntry(eeTopBox, 72.08, "2025-11-01", "Fall 2025");

  const leadershipScorecard = await upsertMetric(strategicDirection, "Leadership Scorecard Components", {
    cadence: "quarterly",
    data_source: "Evaluwise/Manual",
    collection_method: "Quarterly compilation",
    unit: "score",
  });

  const kpiAchievement = await upsertMetric(strategicDirection, "KPI Achievement Rate", {
    cadence: "monthly",
    data_source: "PowerBI dashboards",
    collection_method: "Monthly dashboard review",
    unit: "%",
  });

  const soeScores = await upsertMetric(strategicDirection, "Standards of Excellence Scores", {
    cadence: "annual",
    data_source: "Annual evaluation",
    collection_method: "Annual SOE evaluation",
    unit: "score",
  });

  // Process: Leadership Development
  const leadershipDev = await upsertProcess(
    catMap["1-Leadership"],
    "Leadership Development Process",
    "Developing ELT leadership capabilities through LDI sessions and Foundations program",
    "1.1"
  );
  console.log("  Process: Leadership Development");

  const ldiWellOrganized = await upsertMetric(leadershipDev, "LDI Session - Well Organized Mean", {
    cadence: "quarterly",
    target_value: 4.50,
    data_source: "Post-Session Feedback Survey",
    collection_method: "Google Forms after each LDI session",
    unit: "score",
  });
  await seedEntry(ldiWellOrganized, 5.00, "2023-11-09", "First Team, Onboarding");
  await seedEntry(ldiWellOrganized, 5.00, "2024-02-01", "5 Whys, Interview questions");
  await seedEntry(ldiWellOrganized, 5.00, "2024-04-16", "Financial literacy, Feedforward");
  await seedEntry(ldiWellOrganized, 5.00, "2024-08-13", "Difficult conversations");
  await seedEntry(ldiWellOrganized, 5.00, "2024-09-19", "Asana, Performance convos");
  await seedEntry(ldiWellOrganized, 4.85, "2024-11-07", "Budget, Standards, ADLI");
  await seedEntry(ldiWellOrganized, 4.95, "2025-01-30", "FRISK, FMLA, Restorative practices");
  await seedEntry(ldiWellOrganized, 4.88, "2025-04-10", "Action plans, EOY process");
  await seedEntry(ldiWellOrganized, 4.89, "2025-09-27", "Power BI, Web client, SOE");
  await seedEntry(ldiWellOrganized, 4.93, "2025-11-06", "SOE 2.0 rollout, AI");

  const ldiImportant = await upsertMetric(leadershipDev, "LDI Session - Important to Job Mean", {
    cadence: "quarterly",
    target_value: 4.50,
    data_source: "Post-Session Feedback Survey",
    collection_method: "Google Forms after each LDI session",
    unit: "score",
  });
  await seedEntry(ldiImportant, 5.00, "2023-11-09");
  await seedEntry(ldiImportant, 5.00, "2024-02-01");
  await seedEntry(ldiImportant, 5.00, "2024-04-16");
  await seedEntry(ldiImportant, 5.00, "2024-08-13");
  await seedEntry(ldiImportant, 4.94, "2024-09-19");
  await seedEntry(ldiImportant, 4.85, "2024-11-07");
  await seedEntry(ldiImportant, 5.00, "2025-01-30");
  await seedEntry(ldiImportant, 4.88, "2025-04-10");
  await seedEntry(ldiImportant, 4.89, "2025-09-27");
  await seedEntry(ldiImportant, 4.93, "2025-11-06");

  const ldiAttendance = await upsertMetric(leadershipDev, "ELT LDI Attendance", {
    cadence: "quarterly",
    data_source: "Asana tracking",
    collection_method: "Per session tracking",
    unit: "count",
  });

  const foundationsCompletion = await upsertMetric(leadershipDev, "Foundations Completion Rate", {
    cadence: "annual",
    data_source: "Training records",
    collection_method: "Annual review",
    unit: "%",
  });

  // Process: Performance Management
  const perfMgmt = await upsertProcess(
    catMap["1-Leadership"],
    "Performance Management Process",
    "Annual evaluation cycle with Standards of Excellence and goal alignment",
    "1.1"
  );
  console.log("  Process: Performance Management");

  const orgNps = await upsertMetric(perfMgmt, "Organization NPS", {
    cadence: "semi-annual",
    data_source: "Studer EE Survey",
    collection_method: "Semi-annual survey",
    unit: "score",
  });
  await seedEntry(orgNps, 68.98, "2024-11-01", "Fall 2024");
  await seedEntry(orgNps, 70.61, "2025-04-01", "Spring 2025");
  await seedEntry(orgNps, 76.99, "2025-11-01", "Fall 2025");

  const retention90 = await upsertMetric(perfMgmt, "New Hire 90-Day Retention", {
    cadence: "quarterly",
    data_source: "iSite/HR records",
    collection_method: "Quarterly HR report",
    unit: "%",
  });

  const evalCompletion = await upsertMetric(perfMgmt, "Evaluation Completion Rate", {
    cadence: "annual",
    target_value: 100,
    data_source: "Evaluwise",
    collection_method: "Annual review",
    unit: "%",
  });

  const lowPerfTime = await upsertMetric(perfMgmt, "Time to Address Low Performance", {
    cadence: "annual",
    data_source: "HR tracking",
    collection_method: "As needed",
    unit: "days",
    is_higher_better: false,
  });

  const highPerfTurnover = await upsertMetric(perfMgmt, "Turnover of High Performers", {
    cadence: "annual",
    data_source: "iSite + evaluation data",
    collection_method: "Annual review",
    unit: "%",
    is_higher_better: false,
  });

  // Process: Always Actions
  const alwaysActions = await upsertProcess(
    catMap["1-Leadership"],
    "Always Actions Process",
    "Rounding, recognition, and engagement actions that reinforce culture",
    "1.1"
  );
  console.log("  Process: Always Actions");

  const roundingCompletion = await upsertMetric(alwaysActions, "Rounding Completion Rate (SLT/ELT)", {
    cadence: "monthly",
    data_source: "Rounding log tool",
    collection_method: "Monthly compliance check",
    unit: "%",
  });

  const newHireRounding = await upsertMetric(alwaysActions, "30/90 Day Rounding Completion", {
    cadence: "quarterly",
    data_source: "Rounding log tool",
    collection_method: "Per hire tracking",
    unit: "%",
  });

  // Process: Process Management System
  const processMgmt = await upsertProcess(
    catMap["1-Leadership"],
    "Process Management System",
    "Framework for documenting, improving, and managing organizational processes",
    "1.1"
  );
  console.log("  Process: Process Management System");

  const brightIdeas = await upsertMetric(processMgmt, "Bright Ideas Submitted", {
    cadence: "quarterly",
    data_source: "Bright Ideas Form",
    collection_method: "Quarterly count",
    unit: "count",
  });

  const brightIdeasImpl = await upsertMetric(processMgmt, "Bright Ideas Implemented", {
    cadence: "quarterly",
    data_source: "Tracking TBD",
    collection_method: "Quarterly review",
    unit: "count",
  });

  const processImprovements = await upsertMetric(processMgmt, "Process Improvements Completed", {
    cadence: "quarterly",
    data_source: "Improvement Form",
    collection_method: "Quarterly count",
    unit: "count",
  });

  const docsInHub = await upsertMetric(processMgmt, "Processes Documented in Team Hub", {
    cadence: "annual",
    data_source: "Team Hub audit",
    collection_method: "Annual audit",
    unit: "count",
  });

  const processAwareness = await upsertMetric(processMgmt, "Employee Awareness of Process Tools", {
    cadence: "annual",
    data_source: "Survey",
    collection_method: "Annual EE survey addition",
    unit: "%",
  });

  // Process: Technology Accelerators
  const techAccel = await upsertProcess(
    catMap["1-Leadership"],
    "Technology Accelerators Process",
    "Strategic technology deployment including Asana, PowerBI, and AI tools",
    "1.1"
  );
  console.log("  Process: Technology Accelerators");

  const bssTechMean = await upsertMetric(techAccel, "Technology Dept BSS Mean", {
    cadence: "semi-annual",
    target_value: 4.50,
    data_source: "BSS Survey",
    collection_method: "Semi-annual survey",
    unit: "score",
  });
  await seedEntry(bssTechMean, 4.79, "2023-11-01", "Fall 2023");
  await seedEntry(bssTechMean, 4.80, "2024-04-01", "Spring 2024");
  await seedEntry(bssTechMean, 4.68, "2024-11-01", "Fall 2024");
  await seedEntry(bssTechMean, 4.62, "2025-04-01", "Spring 2025");
  await seedEntry(bssTechMean, 4.73, "2025-11-01", "Fall 2025");

  const bssTechTopBox = await upsertMetric(techAccel, "Technology Dept BSS Top Box %", {
    cadence: "semi-annual",
    data_source: "BSS Survey",
    collection_method: "Semi-annual survey",
    unit: "%",
  });
  await seedEntry(bssTechTopBox, 80.97, "2023-11-01", "Fall 2023");
  await seedEntry(bssTechTopBox, 83.36, "2024-04-01", "Spring 2024");
  await seedEntry(bssTechTopBox, 75.25, "2024-11-01", "Fall 2024");
  await seedEntry(bssTechTopBox, 73.57, "2025-04-01", "Spring 2025");
  await seedEntry(bssTechTopBox, 79.32, "2025-11-01", "Fall 2025");

  const asanaGrowth = await upsertMetric(techAccel, "Asana 3-Year Task Growth", {
    cadence: "annual",
    data_source: "Asana Dashboard",
    collection_method: "Annual review",
    unit: "%",
  });
  await seedEntry(asanaGrowth, 346, "2025-12-31", "2023-2025 growth");

  const asanaTasksCompleted = await upsertMetric(techAccel, "Asana Annual Tasks Completed", {
    cadence: "annual",
    data_source: "Asana Dashboard",
    collection_method: "Annual count",
    unit: "count",
  });
  await seedEntry(asanaTasksCompleted, 1300, "2023-12-31", "CY2023");
  await seedEntry(asanaTasksCompleted, 3600, "2024-12-31", "CY2024");
  await seedEntry(asanaTasksCompleted, 5800, "2025-12-31", "CY2025");

  const asanaGoals = await upsertMetric(techAccel, "Asana Goals Achieved/On Track %", {
    cadence: "quarterly",
    data_source: "Asana Dashboard",
    collection_method: "Quarterly review",
    unit: "%",
  });
  await seedEntry(asanaGoals, 63, "2026-01-31", "41% achieved + 22% on track");

  const asanaOverdue = await upsertMetric(techAccel, "Asana Task Overdue Rate", {
    cadence: "quarterly",
    data_source: "Asana Dashboard",
    collection_method: "Quarterly review",
    unit: "%",
    is_higher_better: false,
  });
  await seedEntry(asanaOverdue, 3, "2026-01-31", "35 of ~1,100 active tasks");

  const platformUptime = await upsertMetric(techAccel, "Platform Uptime", {
    cadence: "monthly",
    data_source: "Vendor reporting",
    collection_method: "Monthly vendor reports",
    unit: "%",
  });

  const dashboardUsage = await upsertMetric(techAccel, "Dashboard Usage", {
    cadence: "monthly",
    data_source: "PowerBI analytics",
    collection_method: "Monthly analytics review",
    unit: "count",
  });

  // Process: Policy Management
  const policyMgmt = await upsertProcess(
    catMap["1-Leadership"],
    "Policy Management Process",
    "PRESS policy development and Board approval cycle",
    "1.2"
  );
  console.log("  Process: Policy Management");

  const pressCycleTime = await upsertMetric(policyMgmt, "PRESS Implementation Cycle Time", {
    cadence: "annual",
    data_source: "Board meeting records",
    collection_method: "Per PRESS issue",
    unit: "days",
    is_higher_better: false,
  });

  const attorneyConsult = await upsertMetric(policyMgmt, "Policies Requiring Attorney Consultation", {
    cadence: "annual",
    data_source: "CEO tracking",
    collection_method: "Per PRESS issue",
    unit: "count",
  });

  const boardApproval = await upsertMetric(policyMgmt, "Board Approval Rate", {
    cadence: "annual",
    data_source: "Board meeting records",
    collection_method: "Annual review",
    unit: "%",
  });

  const policyCompliance = await upsertMetric(policyMgmt, "Policy-Related Compliance Issues", {
    cadence: "annual",
    data_source: "Incident tracking",
    collection_method: "Annual review",
    unit: "count",
    is_higher_better: false,
  });

  // ============================================================
  // CATEGORY 2: STRATEGY
  // ============================================================
  console.log("\n--- Category 2: Strategy ---");

  const strategicPlanning = await upsertProcess(
    catMap["2-Strategy"],
    "Strategic Planning Process",
    "Annual strategic plan development and deployment cycle",
    "2.1"
  );
  console.log("  Process: Strategic Planning");

  // Strategy metrics will be added as processes mature

  // ============================================================
  // CATEGORY 5: WORKFORCE
  // ============================================================
  console.log("\n--- Category 5: Workforce ---");

  // Process: Job Descriptions Management
  const jobDesc = await upsertProcess(
    catMap["5-Workforce"],
    "Job Descriptions Management Process",
    "Systematic review and maintenance of all position descriptions",
    "5.1"
  );
  console.log("  Process: Job Descriptions Management");

  const jdReviewCycle = await upsertMetric(jobDesc, "Job Descriptions with Assigned Review Cycle", {
    cadence: "annual",
    data_source: "Review-Cycle-Assignments.md",
    collection_method: "Annual audit",
    unit: "%",
  });

  const jdOnSchedule = await upsertMetric(jobDesc, "Reviews Completed on Schedule", {
    cadence: "annual",
    data_source: "Asana tracking",
    collection_method: "Annual review",
    unit: "%",
  });

  const jdDraftToApproval = await upsertMetric(jobDesc, "Average Time from Draft to Approval", {
    cadence: "annual",
    data_source: "Asana tracking",
    collection_method: "Per review tracking",
    unit: "days",
    is_higher_better: false,
  });

  const jdSupervisorSat = await upsertMetric(jobDesc, "Supervisor Satisfaction with JD Process", {
    cadence: "annual",
    data_source: "Survey",
    collection_method: "Annual survey",
    unit: "score",
  });

  const jdNewHireClarity = await upsertMetric(jobDesc, "New Hire Clarity on Role Expectations", {
    cadence: "annual",
    data_source: "Onboarding survey",
    collection_method: "Per hire survey",
    unit: "score",
  });

  // Process: Compensation Development
  const compensation = await upsertProcess(
    catMap["5-Workforce"],
    "Compensation Development Process",
    "Market-based compensation analysis and salary schedule management",
    "5.1"
  );
  console.log("  Process: Compensation Development");

  const fillIn60 = await upsertMetric(compensation, "Positions Filled within 60 Days", {
    cadence: "quarterly",
    data_source: "iSite/HR tracking",
    collection_method: "Quarterly report",
    unit: "%",
  });

  const volTurnover = await upsertMetric(compensation, "Voluntary Turnover Rate", {
    cadence: "quarterly",
    data_source: "iSite",
    collection_method: "Quarterly report",
    unit: "%",
    is_higher_better: false,
  });

  const exitCompCited = await upsertMetric(compensation, "Exit Interviews Citing Compensation", {
    cadence: "quarterly",
    data_source: "Exit interview data",
    collection_method: "Quarterly analysis",
    unit: "%",
    is_higher_better: false,
  });

  const rateCompetitiveness = await upsertMetric(compensation, "Daily Rate Competitiveness", {
    cadence: "annual",
    data_source: "Market analysis",
    collection_method: "Annual market study",
    unit: "%",
  });

  const compressionRatio = await upsertMetric(compensation, "Compression Ratio", {
    cadence: "annual",
    data_source: "Salary schedule analysis",
    collection_method: "Annual analysis",
    unit: "score",
    is_higher_better: false,
  });

  // ============================================================
  // CATEGORY 6: OPERATIONS
  // ============================================================
  console.log("\n--- Category 6: Operations ---");

  // Process: Phishing Awareness Testing
  const phishing = await upsertProcess(
    catMap["6-Operations"],
    "Phishing Awareness Testing Process",
    "Quarterly phishing simulation campaigns to test employee security awareness",
    "6.1"
  );
  console.log("  Process: Phishing Awareness Testing");

  const phishClick = await upsertMetric(phishing, "Phishing Click Rate", {
    cadence: "quarterly",
    data_source: "Secure Halo",
    collection_method: "Quarterly campaign reports",
    unit: "%",
    is_higher_better: false,
  });
  await seedEntry(phishClick, 8, "2025-11-01", "Most recent quarter");

  const phishSubmit = await upsertMetric(phishing, "Phishing Submit Rate", {
    cadence: "quarterly",
    data_source: "Secure Halo",
    collection_method: "Quarterly campaign reports",
    unit: "%",
    is_higher_better: false,
  });
  await seedEntry(phishSubmit, 2, "2025-11-01", "Most recent quarter");

  const phishTraining = await upsertMetric(phishing, "Security Training Completion Rate", {
    cadence: "quarterly",
    data_source: "Training records",
    collection_method: "Quarterly review",
    unit: "%",
  });

  const repeatOffender = await upsertMetric(phishing, "Repeat Offender Rate", {
    cadence: "quarterly",
    data_source: "Manual tracking",
    collection_method: "Quarterly review",
    unit: "%",
    is_higher_better: false,
  });

  // Process: Annual Rate Development
  const rateDev = await upsertProcess(
    catMap["6-Operations"],
    "Annual Rate Development Process",
    "Setting service delivery rates using Budget Tool projections and Board approval",
    "6.1"
  );
  console.log("  Process: Annual Rate Development");

  const netOpPosition = await upsertMetric(rateDev, "Net Operating Position", {
    cadence: "annual",
    target_value: 0,
    data_source: "Budget Tool",
    collection_method: "Annual financial close",
    unit: "currency",
    description: "Target is 1-3% surplus. Negative = deficit.",
  });
  await seedEntry(netOpPosition, -315000, "2022-06-30", "FY22 deficit");
  await seedEntry(netOpPosition, -434000, "2024-06-30", "FY24 deficit");
  await seedEntry(netOpPosition, -1095000, "2025-06-30", "FY25 deficit — largest in recent history");

  const servicesDeficit = await upsertMetric(rateDev, "Services Operating at Deficit", {
    cadence: "annual",
    data_source: "Rate analysis",
    collection_method: "Annual rate review",
    unit: "count",
    is_higher_better: false,
  });
  await seedEntry(servicesDeficit, 9, "2025-06-30", "9 of 12 service lines in deficit");

  const avgRateVariance = await upsertMetric(rateDev, "Average Rate Variance (Required vs Approved)", {
    cadence: "annual",
    data_source: "Rate analysis",
    collection_method: "Annual rate comparison",
    unit: "currency",
    description: "Negative = Board-approved rate is below required rate",
  });
  await seedEntry(avgRateVariance, -38.19, "2025-06-30", "Average shortfall per day across services");

  const volumeVariance = await upsertMetric(rateDev, "Volume Variance (Projected vs Actual)", {
    cadence: "annual",
    data_source: "iSite/Budget comparison",
    collection_method: "Annual analysis",
    unit: "%",
    is_higher_better: false,
    description: "Negative = fewer days sold than projected",
  });
  await seedEntry(volumeVariance, -4.8, "2024-06-30", "FY24: 1,767 fewer days than projected");
  await seedEntry(volumeVariance, -4.5, "2025-06-30", "FY25: 1,688 fewer days than projected");

  const rateCompAnalysis = await upsertMetric(rateDev, "Budget Tool vs Board Rate Gap (2-Year)", {
    cadence: "annual",
    data_source: "Budget Tool vs Board",
    collection_method: "Annual comparison",
    unit: "currency",
    is_higher_better: false,
    description: "Cumulative revenue lost by not trusting Budget Tool rates",
  });
  await seedEntry(rateCompAnalysis, -877747, "2025-06-30", "FY24-FY25 combined gap from ad hoc rate decisions");

  // Process: Agency Law Enforcement Requests
  const lawEnforcement = await upsertProcess(
    catMap["6-Operations"],
    "Agency Law Enforcement Requests (7-150)",
    "Procedures for handling law enforcement contacts at NIA service locations",
    "6.2"
  );
  console.log("  Process: Agency Law Enforcement Requests");

  const leTraining = await upsertMetric(lawEnforcement, "Staff Training Completion Rate", {
    cadence: "annual",
    data_source: "Training records",
    collection_method: "Annual review",
    unit: "%",
  });

  const leDocCompliance = await upsertMetric(lawEnforcement, "Documentation Compliance Rate", {
    cadence: "annual",
    data_source: "Exhibit 7:150-E forms",
    collection_method: "Per incident review",
    unit: "%",
  });

  const leCeoNotification = await upsertMetric(lawEnforcement, "CEO Notification within 24 Hours", {
    cadence: "annual",
    data_source: "Incident review",
    collection_method: "Per incident",
    unit: "%",
  });

  const leParentNotification = await upsertMetric(lawEnforcement, "Parent Notification Compliance", {
    cadence: "annual",
    data_source: "Incident review",
    collection_method: "Per incident",
    unit: "%",
  });

  // ============================================================
  // BONUS: Member District Satisfaction (feeds Strategy)
  // ============================================================
  console.log("\n--- Additional: Member District Satisfaction ---");

  const mdsProcess = await upsertProcess(
    catMap["2-Strategy"],
    "Member District Satisfaction Monitoring",
    "Tracking satisfaction of member districts with NIA services",
    "3.1"
  );

  const mdsMean = await upsertMetric(mdsProcess, "Member District Overall Mean", {
    cadence: "semi-annual",
    target_value: 4.50,
    data_source: "Studer MDS Survey",
    collection_method: "Semi-annual survey",
    unit: "score",
  });
  await seedEntry(mdsMean, 4.83, "2024-11-01", "Nov 2024");
  await seedEntry(mdsMean, 4.90, "2025-03-01", "Mar 2025");
  await seedEntry(mdsMean, 4.82, "2025-10-01", "Oct 2025");

  const mdsTopBox = await upsertMetric(mdsProcess, "Member District Overall Top Box %", {
    cadence: "semi-annual",
    data_source: "Studer MDS Survey",
    collection_method: "Semi-annual survey",
    unit: "%",
  });
  await seedEntry(mdsTopBox, 84.27, "2024-11-01", "Nov 2024");
  await seedEntry(mdsTopBox, 91.77, "2025-03-01", "Mar 2025");
  await seedEntry(mdsTopBox, 85.24, "2025-10-01", "Oct 2025");

  // ============================================================
  // BONUS: BSS Overall (feeds multiple processes)
  // ============================================================
  console.log("--- Additional: BSS Overall Satisfaction ---");

  const bssProcess = await upsertProcess(
    catMap["1-Leadership"],
    "Business Support Services Satisfaction",
    "Internal customer satisfaction with Finance, HR, OPs, and Technology departments",
    "1.1"
  );

  const bssOverallMean = await upsertMetric(bssProcess, "BSS Overall Mean", {
    cadence: "semi-annual",
    target_value: 4.50,
    data_source: "Studer BSS Survey",
    collection_method: "Semi-annual survey",
    unit: "score",
  });
  await seedEntry(bssOverallMean, 4.78, "2023-11-01", "Fall 2023");
  await seedEntry(bssOverallMean, 4.79, "2024-04-01", "Spring 2024");
  await seedEntry(bssOverallMean, 4.74, "2024-11-01", "Fall 2024");
  await seedEntry(bssOverallMean, 4.75, "2025-04-01", "Spring 2025");
  await seedEntry(bssOverallMean, 4.78, "2025-11-01", "Fall 2025");

  const bssOverallTopBox = await upsertMetric(bssProcess, "BSS Overall Top Box %", {
    cadence: "semi-annual",
    data_source: "Studer BSS Survey",
    collection_method: "Semi-annual survey",
    unit: "%",
  });
  await seedEntry(bssOverallTopBox, 81.38, "2023-11-01", "Fall 2023");
  await seedEntry(bssOverallTopBox, 82.87, "2024-04-01", "Spring 2024");
  await seedEntry(bssOverallTopBox, 79.11, "2024-11-01", "Fall 2024");
  await seedEntry(bssOverallTopBox, 81.49, "2025-04-01", "Spring 2025");
  await seedEntry(bssOverallTopBox, 82.13, "2025-11-01", "Fall 2025");

  const eltOverallMean = await upsertMetric(bssProcess, "ELT BSS Overall Mean", {
    cadence: "semi-annual",
    data_source: "Studer BSS Survey",
    collection_method: "Semi-annual ELT survey",
    unit: "score",
  });
  await seedEntry(eltOverallMean, 4.84, "2023-11-01", "Fall 2023");
  await seedEntry(eltOverallMean, 4.88, "2024-04-01", "Spring 2024");
  await seedEntry(eltOverallMean, 4.93, "2024-11-01", "Fall 2024");
  await seedEntry(eltOverallMean, 4.95, "2025-04-01", "Spring 2025");
  await seedEntry(eltOverallMean, 4.99, "2025-11-01", "Fall 2025");

  // ============================================================
  // DONE
  // ============================================================

  // Count what we seeded
  const { count: metricCount } = await supabase
    .from("metrics")
    .select("*", { count: "exact", head: true });
  const { count: entryCount } = await supabase
    .from("entries")
    .select("*", { count: "exact", head: true });
  const { count: processCount } = await supabase
    .from("processes")
    .select("*", { count: "exact", head: true });

  console.log("\n========================================");
  console.log("SEED COMPLETE");
  console.log(`  Processes: ${processCount}`);
  console.log(`  Metrics:   ${metricCount}`);
  console.log(`  Entries:   ${entryCount}`);
  console.log("========================================\n");
}

seed().catch(console.error);
