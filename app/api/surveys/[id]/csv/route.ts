import { createSupabaseServer } from "@/lib/supabase-server";

// GET ?waveId=N — returns CSV of raw survey response data
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServer();
  const { id } = await params;
  const surveyId = Number(id);
  const { searchParams } = new URL(request.url);
  const waveId = searchParams.get("waveId");

  if (!waveId) {
    return new Response("waveId is required", { status: 400 });
  }

  // Fetch survey title for filename
  const { data: survey } = await supabase
    .from("surveys")
    .select("title")
    .eq("id", surveyId)
    .single();

  // Fetch wave
  const { data: wave } = await supabase
    .from("survey_waves")
    .select("wave_number")
    .eq("id", Number(waveId))
    .eq("survey_id", surveyId)
    .single();

  if (!wave) {
    return new Response("Wave not found", { status: 404 });
  }

  // Fetch questions
  const { data: questions } = await supabase
    .from("survey_questions")
    .select("id, question_text, question_type, options")
    .eq("survey_id", surveyId)
    .order("sort_order", { ascending: true });

  if (!questions || questions.length === 0) {
    return new Response("No questions", { status: 400 });
  }

  // Fetch responses
  const { data: responses } = await supabase
    .from("survey_responses")
    .select("id, created_at")
    .eq("wave_id", Number(waveId))
    .order("created_at", { ascending: true });

  if (!responses || responses.length === 0) {
    return new Response("No responses", { status: 400 });
  }

  // Fetch all answers
  const responseIds = responses.map((r) => r.id);
  const { data: answers } = await supabase
    .from("survey_answers")
    .select("response_id, question_id, value_numeric, value_text, value_json")
    .in("response_id", responseIds);

  const allAnswers = answers || [];

  // Build answer lookup: response_id -> question_id -> answer
  const answerMap = new Map<number, Map<number, typeof allAnswers[0]>>();
  for (const a of allAnswers) {
    if (!answerMap.has(a.response_id)) answerMap.set(a.response_id, new Map());
    answerMap.get(a.response_id)!.set(a.question_id, a);
  }

  // For matrix questions, group answers by response_id and question_id
  // (multiple answer rows per response per matrix question)
  const matrixAnswers = new Map<number, Map<number, typeof allAnswers>>();
  for (const a of allAnswers) {
    const q = questions.find((q) => q.id === a.question_id);
    if (q?.question_type === "matrix") {
      if (!matrixAnswers.has(a.response_id)) matrixAnswers.set(a.response_id, new Map());
      const respMap = matrixAnswers.get(a.response_id)!;
      if (!respMap.has(a.question_id)) respMap.set(a.question_id, []);
      respMap.get(a.question_id)!.push(a);
    }
  }

  // Build CSV header
  const headers = ["response_id", "submitted_at"];
  for (const q of questions) {
    if (q.question_type === "matrix") {
      // One column per matrix row
      const rows = ((q.options as Record<string, unknown>)?.rows as string[]) || [];
      for (const rowLabel of rows) {
        headers.push(`${q.question_text} - ${rowLabel}`);
      }
    } else {
      headers.push(q.question_text);
    }
  }

  // Build CSV rows
  const csvRows: string[] = [headers.map(csvEscape).join(",")];

  for (const resp of responses) {
    const cells: string[] = [
      String(resp.id),
      resp.created_at,
    ];

    for (const q of questions) {
      const answer = answerMap.get(resp.id)?.get(q.id);

      switch (q.question_type) {
        case "rating":
        case "nps":
          cells.push(answer?.value_numeric != null ? String(answer.value_numeric) : "");
          break;

        case "yes_no":
          cells.push(answer?.value_numeric === 1 ? "Yes" : answer?.value_numeric === 0 ? "No" : "");
          break;

        case "multiple_choice": {
          const choices = ((q.options as Record<string, unknown>)?.choices as string[]) || [];
          const idx = answer?.value_numeric;
          if (idx != null && idx >= 0 && idx < choices.length) {
            cells.push(choices[idx]);
          } else if (answer?.value_text) {
            cells.push(`Other: ${answer.value_text}`);
          } else {
            cells.push("");
          }
          break;
        }

        case "checkbox": {
          const choices = ((q.options as Record<string, unknown>)?.choices as string[]) || [];
          const json = answer?.value_json as { selected?: number[] } | null;
          if (json?.selected) {
            const selected = json.selected.map((i) => choices[i] || `Option ${i}`);
            if (answer?.value_text) selected.push(`Other: ${answer.value_text}`);
            cells.push(selected.join("; "));
          } else {
            cells.push("");
          }
          break;
        }

        case "open_text":
          cells.push(answer?.value_text || "");
          break;

        case "matrix": {
          const rows = ((q.options as Record<string, unknown>)?.rows as string[]) || [];
          const columns = ((q.options as Record<string, unknown>)?.columns as string[]) || [];
          const mAnswers = matrixAnswers.get(resp.id)?.get(q.id) || [];

          for (let ri = 0; ri < rows.length; ri++) {
            const rowAnswer = mAnswers.find((a) => {
              const json = a.value_json as { row_index?: number } | null;
              return json?.row_index === ri;
            });
            if (rowAnswer?.value_numeric != null && rowAnswer.value_numeric < columns.length) {
              cells.push(columns[rowAnswer.value_numeric]);
            } else {
              cells.push("");
            }
          }
          break;
        }

        default:
          cells.push(answer?.value_numeric != null ? String(answer.value_numeric) : answer?.value_text || "");
      }
    }

    csvRows.push(cells.map(csvEscape).join(","));
  }

  const csv = csvRows.join("\n");
  const filename = `${slugify(survey?.title || "survey")}-round-${wave.wave_number}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
