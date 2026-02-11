import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

// Runs daily at midnight UTC — creates scheduled waves for recurring surveys
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use service role client to bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch all surveys with recurrence enabled
  const { data: recurringSurveys } = await supabase
    .from("surveys")
    .select("id, recurrence_cadence, recurrence_duration_days")
    .eq("recurrence_enabled", true)
    .not("recurrence_cadence", "is", null);

  if (!recurringSurveys || recurringSurveys.length === 0) {
    return NextResponse.json({ success: true, created: 0, message: "No recurring surveys" });
  }

  let created = 0;

  for (const survey of recurringSurveys) {
    // Get the most recent wave (any status)
    const { data: lastWave } = await supabase
      .from("survey_waves")
      .select("id, wave_number, status, closed_at, scheduled_open_at")
      .eq("survey_id", survey.id)
      .order("wave_number", { ascending: false })
      .limit(1)
      .single();

    // Skip if there's already a scheduled wave waiting
    if (lastWave?.status === "scheduled") continue;

    // Skip if there's an open wave (wait for it to close first)
    if (lastWave?.status === "open") continue;

    // Determine the cadence interval in days
    const cadenceDays = survey.recurrence_cadence === "monthly" ? 30 : 90;

    // Check if enough time has passed since the last wave closed
    if (lastWave?.closed_at) {
      const closedDate = new Date(lastWave.closed_at);
      const nextDueDate = new Date(closedDate.getTime() + cadenceDays * 24 * 60 * 60 * 1000);

      if (new Date() < nextDueDate) continue; // Not due yet
    }

    // No waves at all? Create the first scheduled wave
    // (Survey was just configured for recurrence)

    const nextWaveNumber = (lastWave?.wave_number || 0) + 1;
    const shareToken = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    const durationDays = survey.recurrence_duration_days || 14;

    // Schedule to open tomorrow at 9am UTC
    const openAt = new Date();
    openAt.setUTCDate(openAt.getUTCDate() + 1);
    openAt.setUTCHours(9, 0, 0, 0);

    const closeAt = new Date(openAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const { error } = await supabase
      .from("survey_waves")
      .insert({
        survey_id: survey.id,
        wave_number: nextWaveNumber,
        status: "scheduled",
        share_token: shareToken,
        scheduled_open_at: openAt.toISOString(),
        scheduled_close_at: closeAt.toISOString(),
      });

    if (!error) created++;
  }

  return NextResponse.json({
    success: true,
    created,
    surveysChecked: recurringSurveys.length,
  });
}
