import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { isAdminRole } from "@/lib/auth-helpers";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 55_000,
  maxRetries: 0,
});

/**
 * POST /api/criteria/ai-suggest
 * Given a question_id, asks AI which processes best answer it.
 * Returns structured suggestions with rationale.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();

  // Admin check
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
  if (!isAdminRole(roleData?.role || "")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Rate limit check
  const rl = await checkRateLimit(user.id);
  if (!rl.success) return rl.response;

  const body = await request.json();
  const { question_id } = body;

  if (!question_id) {
    return NextResponse.json({ error: "question_id is required" }, { status: 400 });
  }

  // Fetch the question
  const { data: question } = await supabase
    .from("baldrige_questions")
    .select("*, baldrige_items(*)")
    .eq("id", question_id)
    .single();

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  // Fetch all processes with summary data
  const { data: processes } = await supabase
    .from("processes")
    .select("id, name, description, owner, baldrige_item, charter, adli_approach, adli_deployment, adli_learning, adli_integration")
    .order("name");

  if (!processes || processes.length === 0) {
    return NextResponse.json({ suggestions: [], message: "No processes found" });
  }

  // Build compact process summaries for AI context
  const processSummaries = processes.map((p) => {
    const parts = [`[${p.id}] ${p.name}`];
    if (p.description) parts.push(`Desc: ${String(p.description).slice(0, 150)}`);
    if (p.baldrige_item) parts.push(`Baldrige: ${p.baldrige_item}`);

    const charter = p.charter as Record<string, unknown> | null;
    if (charter?.content) {
      parts.push(`Charter: ${String(charter.content).slice(0, 200)}`);
    } else if (charter?.purpose) {
      parts.push(`Purpose: ${String(charter.purpose).slice(0, 200)}`);
    }

    // ADLI summaries (first 100 chars each)
    for (const dim of ["adli_approach", "adli_deployment", "adli_learning", "adli_integration"]) {
      const val = p[dim as keyof typeof p] as Record<string, unknown> | null;
      if (val?.content) {
        const label = dim.replace("adli_", "").charAt(0).toUpperCase() + dim.replace("adli_", "").slice(1);
        parts.push(`${label}: ${String(val.content).slice(0, 100)}`);
      }
    }

    return parts.join(" | ");
  });

  // Fetch existing mappings for this question to avoid duplicates
  const { data: existingMappings } = await supabase
    .from("process_question_mappings")
    .select("process_id")
    .eq("question_id", question_id);

  const mappedIds = new Set((existingMappings || []).map((m) => m.process_id));

  const item = question.baldrige_items as unknown as { item_code: string; item_name: string; category_name: string };

  const systemPrompt = `You are a Baldrige Excellence Framework expert helping map NIA's processes to specific criteria questions.

Given a Baldrige criteria question and a list of organizational processes, identify which processes best answer the question.

For each suggested process, provide:
- process_id (the numeric ID from the list)
- process_name (for display)
- coverage: "primary" (directly addresses the core of the question), "supporting" (contributes but doesn't fully address), or "partial" (touches on part of the question)
- rationale: 1-2 sentences explaining WHY this process answers the question

Return 1-5 suggestions, ranked by relevance. If no process is a good match, return an empty array.
Already mapped process IDs (skip these): ${[...mappedIds].join(", ") || "none"}

Respond with ONLY a JSON array, no other text:
[{"process_id": 1, "process_name": "Example", "coverage": "primary", "rationale": "This process..."}]`;

  const userPrompt = `**Baldrige Question:**
Item: ${item.item_code} ${item.item_name} (Category: ${item.category_name})
Code: ${question.question_code}
Area: ${question.area_label}
Question: ${question.question_text}

**Available Processes:**
${processSummaries.join("\n\n")}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON from response (handle possible markdown wrapping)
    let suggestions;
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      suggestions = [];
    }

    return NextResponse.json({ suggestions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
