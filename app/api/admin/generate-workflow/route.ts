import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { isSuperAdminRole } from "@/lib/auth-helpers";

export const maxDuration = 120;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 115_000,
  maxRetries: 0,
});

// ── NIA Org Profile context ────────────────────────────────────────────────
// Extracted from "2024-06-05 NIA Organization Profile (For Submission).pdf"
const NIA_ORG_PROFILE = `
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

CUSTOMERS: Member Districts (priority — high-quality, cost-effective), Non-Member Entities (high-quality, cost-effective)
STAKEHOLDERS: Parents (high-quality, good communication), Students (high-quality, engaging delivery), Workforce (competitive compensation, clear communication, meaningful work)

REGULATORY ENVIRONMENT: Highly regulated — Illinois School Code (ILSC), Part 226 Illinois Administrative Code, IDEA (federal). All service providers require strict licensure and certification from ISBE, IL Dept of Financial and Professional Regulation, and specialty boards. NIA must also comply with district partner policies.

STRATEGIC CHALLENGES:
  - Workforce: Staffing shortages in all service areas; workforce dispersed across 10 counties; rising educational requirements for licensure (e.g., PT now requires DPT)
  - Customer Retention: Limited understanding of NIA's value proposition vs staffing agencies; rising cost of "turn-key" services
  - Performance Improvement: PEEI system (Plan, Execute, Evaluate, Improve); quarterly SP goal reviews; weekly Executive Leadership Team meetings

KEY TECHNOLOGIES: Laserfiche (electronic workflow), Happeo (intranet/communication), APECS (financial/HR), iSite (service request tracking/timekeeping/fulfillment), NIA Student Database, Illinois Medicaid Reporting System, Case Management & Progress Monitoring System, Evaluswise (organizational evaluation tracking)

KEY PARTNERS/COLLABORATORS: Universities (staff pipeline), Clinical/Medical Providers (specialized equipment), Hawthorne LLC (Illinois Medicaid reporting), Studer Education (leadership development, customer/stakeholder surveys), Staffing Agencies (flexible workforce), Software/IT Consultants (digital infrastructure)
`.trim();

export interface GapItem {
  name: string;
  baldrigeItem: string;
  priority: "high" | "medium" | "low";
  rationale: string;
}

/**
 * POST /api/admin/generate-workflow
 * Generates a Mermaid flowchart of KEY processes only, mapped to the Baldrige
 * Systems Model, color-coded by ADLI maturity. Also returns gap analysis —
 * key processes implied by NIA's org profile or required by Baldrige that
 * don't exist yet.
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

BALDRIGE SYSTEMS MODEL structure:
- Category 1 (Leadership): How senior leaders guide the organization
- Category 2 (Strategy): How strategic objectives and action plans are developed
- Category 3 (Customers): How customer and market needs are addressed
- Category 4 (Measurement): How data drives decisions and knowledge management
- Category 5 (Workforce): How workforce capability and engagement are built
- Category 6 (Operations): How key work processes are designed, managed, improved
- Category 7 (Results): Performance and outcomes

ADLI MATURITY classDef names to use in Mermaid:
- "integrated" = overall score 70–100% — fill:#324a4d,color:#fff,stroke:#2a3d40
- "aligned" = overall score 50–69% — fill:#b1bd37,color:#000,stroke:#9aab2c
- "early" = overall score 30–49% — fill:#f79935,color:#000,stroke:#e08820
- "reacting" = overall score 0–29% — fill:#dc2626,color:#fff,stroke:#b91c1c
- "unscored" = no ADLI data — fill:#9ca3af,color:#fff,stroke:#6b7280

MERMAID RULES (follow strictly):
1. Start with: flowchart TB
2. Define all 5 classDefs immediately after the direction line
3. Use subgraph for each Baldrige category that contains at least one process
4. Node ID = p{id} (e.g., p5 for process ID 5)
5. Node label = short name (max 22 chars) — abbreviate freely, put score in parens: "Svc Delivery (71%)"
6. Arrows: max 2–3 per process — only the most meaningful connections
7. After all subgraphs and arrows, assign a class to every node: class p5 integrated
8. Do NOT use style statements — only classDef + class assignments
9. Wrap any label containing special characters in double quotes`;

  const userPrompt = `Here are NIA's current KEY processes:

${processList}

Generate TWO things:

---MERMAID---
The complete Mermaid flowchart (raw code only, no fences) showing these key processes organized into Baldrige System Model subgraphs, with arrows for the most meaningful connections, and class assignments for maturity coloring.

---GAPS---
A JSON array of key processes that are MISSING from NIA's Hub — processes implied by NIA's organizational profile (services, regulatory environment, strategic challenges) or required by Baldrige Category 6.1 (key work processes) that don't appear in the list above. Be specific and actionable.

Format for each gap item:
{"name": "Process Name", "baldrigeItem": "6.1", "priority": "high", "rationale": "One clear sentence explaining why this process is needed based on NIA's org profile."}

Priority guide: "high" = NIA clearly delivers this service or faces this challenge but has no documented process; "medium" = implied by Baldrige best practice for this org type; "low" = aspirational/growth.

Return ONLY the two sections with their headers. No other text.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Parse the two delimited sections
    const mermaidMatch = text.match(/---MERMAID---\s*([\s\S]*?)(?=---GAPS---|$)/);
    const gapsMatch = text.match(/---GAPS---\s*([\s\S]*?)$/);

    let mermaid = mermaidMatch ? mermaidMatch[1].trim() : "";
    let gaps: GapItem[] = [];

    // Strip any accidental markdown fences around the mermaid block
    mermaid = mermaid
      .replace(/^```mermaid\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

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

    if (!mermaid) {
      return NextResponse.json({ error: "AI did not return a valid diagram" }, { status: 500 });
    }

    return NextResponse.json({
      mermaid,
      gaps,
      generatedAt: new Date().toISOString(),
      keyCount: keyProcesses.length,
    });
  } catch (err) {
    console.error("Workflow generation error:", err);
    return NextResponse.json({ error: "Failed to generate workflow diagram" }, { status: 500 });
  }
}
