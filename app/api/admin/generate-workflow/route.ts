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

/**
 * POST /api/admin/generate-workflow
 * AI generates a Mermaid flowchart of all key processes mapped to the
 * Baldrige Systems Model, color-coded by ADLI maturity.
 * Super admin only.
 */
export async function POST() {
  const supabase = await createSupabaseServer();

  // Auth check — super_admin only
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

  // Fetch all processes (key processes get subgraph treatment; support still appears)
  const { data: processes, error: procError } = await supabase
    .from("processes")
    .select(
      `id, name, process_type, baldrige_item,
       adli_integration,
       categories!inner(display_name, sort_order)`
    )
    .order("name");

  if (procError || !processes) {
    return NextResponse.json({ error: "Failed to fetch processes" }, { status: 500 });
  }

  // Fetch ADLI scores for all processes
  const { data: scores } = await supabase
    .from("process_adli_scores")
    .select("process_id, overall_score");

  const scoreMap = new Map<number, number>();
  for (const s of scores || []) {
    scoreMap.set(s.process_id, s.overall_score);
  }

  // Build process summaries for the prompt
  const processSummaries = processes.map((p) => {
    const cat = p.categories as unknown as { display_name: string; sort_order: number };
    const score = scoreMap.get(p.id);
    const integration = p.adli_integration as Record<string, unknown> | null;
    const relatedRaw = integration?.related_processes;
    const related = Array.isArray(relatedRaw)
      ? (relatedRaw as string[]).slice(0, 3).join(", ")
      : typeof relatedRaw === "string"
      ? String(relatedRaw).slice(0, 100)
      : "";

    return [
      `ID:${p.id} | "${p.name}" | Type:${p.process_type || "unclassified"} | Category:${cat.display_name}`,
      p.baldrige_item ? `  Baldrige Item: ${p.baldrige_item}` : "",
      score != null ? `  ADLI Overall: ${score}%` : "  ADLI: Unscored",
      related ? `  Related processes: ${related}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const systemPrompt = `You are a Baldrige Excellence Framework expert and diagram architect.

The Baldrige Systems Model has three integrated components:
1. **Leadership Triad** (Categories 1-3): Leadership, Strategy, Customers
2. **Operations** (Categories 4-6): Workforce, Operations, Results
3. **Foundation**: Measurement, Analysis, and Knowledge Management (Category 4)

ADLI Maturity color coding (use these hex fills in style definitions):
- Integrated (70-100): fill:#324a4d,color:#ffffff
- Aligned (50-69): fill:#b1bd37,color:#000000
- Early Systematic (30-49): fill:#f79935,color:#000000
- Reacting (0-29): fill:#dc2626,color:#ffffff
- Unscored: fill:#9ca3af,color:#ffffff

IMPORTANT Mermaid rules:
- Use flowchart TB direction
- Use subgraph blocks for each Baldrige category (Leadership, Strategy, Customers, etc.)
- Node IDs must be alphanumeric — use pN format (e.g. p12 for ID:12)
- Node labels: "ProcessName (score%)" — keep under 30 chars, abbreviate if needed
- Draw arrows (-->) between related processes using their IDs
- Add style definitions at the end for each node based on ADLI maturity
- Wrap node labels in quotes if they contain special characters
- Keep it readable — limit to meaningful connections, not every possible link`;

  const userPrompt = `Generate a Mermaid flowchart TB diagram for NIA's organizational processes mapped to the Baldrige Systems Model.

PROCESSES:
${processSummaries.join("\n\n")}

Generate ONLY the raw Mermaid code — no markdown fences, no explanation. Start directly with "flowchart TB".`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const mermaid =
      response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Strip markdown fences if model added them anyway
    const cleaned = mermaid
      .replace(/^```mermaid\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    return NextResponse.json({
      mermaid: cleaned,
      generatedAt: new Date().toISOString(),
      processCount: processes.length,
      keyCount: processes.filter((p) => p.process_type === "key").length,
    });
  } catch (err) {
    console.error("Workflow generation error:", err);
    return NextResponse.json({ error: "Failed to generate workflow diagram" }, { status: 500 });
  }
}
