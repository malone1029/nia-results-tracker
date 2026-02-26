import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { isSuperAdminRole } from "@/lib/auth-helpers";
import type { MissionFlowData } from "@/lib/flow-types";

export const maxDuration = 120;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 115_000,
  maxRetries: 0,
});

// ── NIA Org Profile context ────────────────────────────────────────────────
// Extracted from "2024-06-05 NIA Organization Profile (For Submission).pdf"
export const NIA_ORG_PROFILE = `
NIA ORGANIZATIONAL PROFILE — Northwestern Illinois Association (June 2024)

MISSION: Partnering with School Districts to Serve Students with Unique Needs
VISION: Recognized leader in special education support to school districts in northwestern Illinois, offering unparalleled expertise, innovative solutions, and unmistakable value.
VALUES: Integrity, Collaboration, Innovation, Accountability
CORE COMPETENCIES: (1) Expertise in Special Ed Service Delivery for All Service Areas, (2) Mastery of Regulatory Compliance in Illinois, (3) Exceptional Customer Service, (4) Superior Interdisciplinary Collaboration, (5) Innovative Problem-Solving

ORGANIZATION: Governmental special education cooperative. 63 member school districts, 10 counties (Boone, Carroll, DeKalb, JoDaviets, Kane, Lee, Stephenson, Whiteside, Winnebago). 276 employees: 5 Executive Leadership, 17 Service Supervision, 241 Student Service Providers, 13 Business Support. ~35,575 days sold (FY2024).

KEY SERVICES (% of revenue) — delivered via Direct-to-Student (DS), School Team Consultation (ST), or Professional Development (PD):
School Services (90% of revenue):
  - Occupational Therapy: DS, ST, PD (53%)
  - Physical Therapy: DS, ST, PD (14%)
  - Speech-Language Therapy: DS, ST, PD (10%)
  - Vision Impaired Instruction / Orientation & Mobility: DS, ST, PD (11%)
  - Audiology: DS, ST, PD (4%)
  - Sign Language Interpretation: DS (4%)
  - Deaf/Hard-of-Hearing Instruction: DS, ST, PD (3%)
  - Board Certified Behavior Analysis (BCBA): ST, PD
  - Autism Support: ST, PD
  - Psychology: ST, PD (new)
  - Social Work: DS, ST (new)
School Program (10% of revenue):
  - D/HH School Program: Pre-K through Age 21 for students who are Deaf/Hard-of-Hearing

PURCHASING CUSTOMERS: Member & Partner Districts — high-quality services, cost-effective delivery, prioritized access, good customer service. (Member districts are formal cooperative members; partner districts purchase services without membership. Both groups are the primary external customers NIA is accountable to.)

KEY STAKEHOLDERS:
  - Workforce: competitive compensation/benefits, meaningful work, clear communication, input and engagement, responsive leadership
  - NIA Executive Board (Governance): fiscal stewardship, policy compliance, strategic goal achievement, transparent reporting, customer satisfaction monitoring, employee engagement monitoring
  - ISBE & Regulatory Bodies: IDEA compliance, FERPA/SOPPA compliance, HIPAA compliance, ISBE reporting accuracy and timeliness

NOTE ON BENEFICIARIES: Students and parents are the ultimate beneficiaries of NIA's services, delivered through member districts. Their needs matter, but their requirements flow through purchasing customers (districts), not directly to NIA. They are not managed as direct stakeholder groups in NIA's key requirement framework.

REGULATORY ENVIRONMENT: Highly regulated — Illinois School Code (ILSC), Part 226 Illinois Administrative Code, IDEA (federal). All service providers require strict licensure and certification from ISBE, IL Dept of Financial and Professional Regulation, and specialty boards. NIA must also comply with district partner policies.

STRATEGIC CHALLENGES:
  - Workforce: Staffing shortages in all service areas; workforce dispersed across 10 counties; rising educational requirements for licensure (e.g., PT now requires DPT)
  - Customer Retention: Limited understanding of NIA's value proposition vs staffing agencies; rising cost of "turn-key" services
  - Performance Improvement: PEEI system (Plan, Execute, Evaluate, Improve); quarterly SP goal reviews; weekly Executive Leadership Team meetings

KEY TECHNOLOGIES: Laserfiche (electronic workflow), Happeo (intranet/communication), APECS (financial/HR), iSite (service request tracking/timekeeping/fulfillment), NIA Student Database, Illinois Medicaid Reporting System, Case Management & Progress Monitoring System, Evaluswise (organizational evaluation tracking)

KEY PARTNERS/COLLABORATORS: Universities (staff pipeline), Clinical/Medical Providers (specialized equipment), Hawthorne LLC (Illinois Medicaid reporting), Studer Education (leadership development, customer/stakeholder surveys), Staffing Agencies (flexible workforce), Software/IT Consultants (digital infrastructure)
`.trim();

// All 7 Baldrige categories for context (exported so workflow-chat can reuse)
export const BALDRIGE_CATEGORIES = [
  { number: 1, name: "Leadership", description: "How senior leaders guide the organization" },
  { number: 2, name: "Strategy", description: "How strategic objectives and action plans are developed" },
  { number: 3, name: "Customers", description: "How customer and market needs are addressed" },
  { number: 4, name: "Measurement", description: "How data drives decisions and knowledge management" },
  { number: 5, name: "Workforce", description: "How workforce capability and engagement are built" },
  { number: 6, name: "Operations", description: "How key work processes are designed, managed, improved" },
  { number: 7, name: "Results", description: "Performance and outcomes (not shown in workflow)" },
] as const;

export interface GapItem {
  name: string;
  baldrigeItem: string;
  baldrigeCategory: number; // 1–6 — which category subgraph to place the gap node in
  priority: "high" | "medium" | "low";
  rationale: string;
}

/**
 * POST /api/admin/generate-workflow
 * Generates a Mermaid flowchart of KEY processes only, mapped to the Baldrige
 * Systems Model, color-coded by ADLI maturity. All 6 categories appear as
 * subgraphs even if empty. Gap nodes are placed inside the correct subgraph.
 * Super admin only.
 */
export async function POST() {
  const supabase = await createSupabaseServer();

  // Auth — super_admin only
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("auth_id", user.id)
    .single();
  if (!isSuperAdminRole(roleData?.role || "")) {
    return NextResponse.json({ error: "Super admin access required" }, { status: 403 });
  }

  // Fetch KEY processes only
  const { data: keyProcesses, error: procError } = await supabase
    .from("processes")
    .select(
      `id, name, baldrige_item, adli_integration,
       categories!inner(display_name, sort_order)`
    )
    .eq("process_type", "key")
    .order("name");

  if (procError) {
    return NextResponse.json({ error: "Failed to fetch processes" }, { status: 500 });
  }

  if (!keyProcesses || keyProcesses.length === 0) {
    return NextResponse.json(
      { error: "No key processes found. Use the Key Process Classifier above to assign key processes first." },
      { status: 400 }
    );
  }

  // Fetch ADLI scores for key processes
  const keyIds = keyProcesses.map((p) => p.id);
  const { data: scores } = await supabase
    .from("process_adli_scores")
    .select("process_id, overall_score")
    .in("process_id", keyIds);

  const scoreMap = new Map<number, number>();
  for (const s of scores || []) {
    scoreMap.set(s.process_id, s.overall_score);
  }

  // Build compact process list for the prompt
  const processList = keyProcesses.map((p) => {
    const cat = p.categories as unknown as { display_name: string; sort_order: number };
    const score = scoreMap.get(p.id);
    const integration = p.adli_integration as Record<string, unknown> | null;
    const relatedRaw = integration?.related_processes;
    const related = Array.isArray(relatedRaw)
      ? (relatedRaw as string[]).slice(0, 2).join(", ")
      : typeof relatedRaw === "string"
      ? String(relatedRaw).slice(0, 80)
      : "";

    const parts = [
      `[p${p.id}] ${p.name}`,
      `  Category: ${cat.display_name}`,
      p.baldrige_item ? `  Baldrige Item: ${p.baldrige_item}` : "",
      score != null ? `  ADLI Score: ${score}%` : "  ADLI: Unscored",
      related ? `  Related to: ${related}` : "",
    ];
    return parts.filter(Boolean).join("\n");
  }).join("\n\n");

  const systemPrompt = `You are a Baldrige Excellence Framework expert analyzing a special education cooperative.

${NIA_ORG_PROFILE}

BALDRIGE SYSTEMS MODEL — all 6 workflow categories:
- Category 1 (Leadership): How senior leaders guide the organization
- Category 2 (Strategy): How strategic objectives and action plans are developed
- Category 3 (Customers): How customer and market needs are addressed
- Category 4 (Measurement): How data drives decisions and knowledge management
- Category 5 (Workforce): How workforce capability and engagement are built
- Category 6 (Operations): How key work processes are designed, managed, improved
(Category 7 Results is not shown in the workflow diagram)

ADLI MATURITY classes for existing process nodes:
- "integrated" = overall score 70–100%
- "aligned" = overall score 50–69%
- "early" = overall score 30–49%
- "reacting" = overall score 0–29%
- "unscored" = no ADLI data
- "gap" = gap/missing process`;

  const userPrompt = `Here are NIA's current KEY processes:

${processList}

Generate TWO sections:

---FLOW---
A JSON object with "nodes" and "edges" arrays representing NIA's Mission Workflow:

Node format:
{
  "id": "p5",
  "label": "Svc Delivery (71%)",
  "adliClass": "integrated",
  "adliScore": 71,
  "baldrigeCategory": 6,
  "isGap": false
}

Gap node format:
{
  "id": "g1",
  "label": "Workforce Recruitment",
  "adliClass": "gap",
  "baldrigeCategory": 5,
  "isGap": true,
  "priority": "high"
}

Edge format:
{"id": "e1", "source": "p5", "target": "p12"}

Rules:
- Include ALL existing key processes (id = "p{processId}", e.g. "p5" for process ID 5)
- Include gap nodes from the analysis below (id = "g1", "g2", etc.)
- "baldrigeCategory" must be 1–6 — determines which category section the node appears in
- "label" max 22 characters — abbreviate freely, include score like "(71%)" if available
- "adliClass" must be one of: integrated, aligned, early, reacting, unscored, gap
- Edges: max 2–3 per process, only the most meaningful workflow connections
- Return valid minified JSON, no markdown fences

---GAPS---
A JSON array of key processes MISSING from NIA's Hub — implied by NIA's organizational profile (services, regulatory environment, strategic challenges) or required by Baldrige 6.1. Limit to the 6 most important gaps.

Format:
{"name": "Process Name", "baldrigeItem": "6.1", "baldrigeCategory": 6, "priority": "high", "rationale": "One clear sentence why this is needed."}

Rules:
- "baldrigeCategory" must be 1–6
- Priority: "high" = NIA clearly operates this but hasn't documented it; "medium" = Baldrige best practice; "low" = aspirational

Return ONLY the two sections with their delimiters. No other text.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      // NIA_ORG_PROFILE + Baldrige definitions = ~1,100 static tokens — cache them.
      system: [{ type: "text" as const, text: systemPrompt, cache_control: { type: "ephemeral" as const } }],
      messages: [{ role: "user", content: userPrompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Parse the two delimited sections
    const flowMatch = text.match(/---FLOW---\s*([\s\S]*?)(?=---GAPS---|$)/);
    const gapsMatch = text.match(/---GAPS---\s*([\s\S]*?)$/);

    let flowData: MissionFlowData | null = null;
    let gaps: GapItem[] = [];

    if (flowMatch) {
      try {
        // Strip any accidental markdown fences
        const raw = flowMatch[1]
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```\s*$/, "")
          .trim();
        flowData = JSON.parse(raw) as MissionFlowData;
      } catch {
        console.warn("Failed to parse flow JSON");
      }
    }

    if (gapsMatch) {
      try {
        const jsonMatch = gapsMatch[1].match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          gaps = JSON.parse(jsonMatch[0]) as GapItem[];
        }
      } catch {
        console.warn("Failed to parse gaps JSON");
      }
    }

    if (!flowData) {
      return NextResponse.json({ error: "AI did not return a valid diagram" }, { status: 500 });
    }

    return NextResponse.json({
      flowData,
      gaps,
      generatedAt: new Date().toISOString(),
      keyCount: keyProcesses.length,
    });
  } catch (err) {
    console.error("Workflow generation error:", err);
    return NextResponse.json({ error: "Failed to generate workflow diagram" }, { status: 500 });
  }
}
