import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

// GET ?processId=5 → list conversations (id, title, dates only)
// GET ?id=42       → fetch single conversation with full messages
export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const processId = searchParams.get("processId");

  if (id) {
    const { data, error } = await supabase
      .from("ai_conversations")
      .select("*")
      .eq("id", Number(id))
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  if (processId) {
    const { data, error } = await supabase
      .from("ai_conversations")
      .select("id, title, created_at, updated_at")
      .eq("process_id", Number(processId))
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "processId or id is required" }, { status: 400 });
}

// POST — create a new conversation
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const body = await request.json();

  const { process_id, title, messages, adli_scores } = body;

  if (!process_id) {
    return NextResponse.json({ error: "process_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({
      process_id,
      title: title || "New Conversation",
      messages: messages || [],
      adli_scores: adli_scores || null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, success: true });
}

// PATCH — update messages / scores after each AI response
export async function PATCH(request: Request) {
  const supabase = await createSupabaseServer();
  const body = await request.json();

  const { id, messages, adli_scores, title } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (messages !== undefined) updates.messages = messages;
  if (adli_scores !== undefined) updates.adli_scores = adli_scores;
  if (title !== undefined) updates.title = title;

  const { error } = await supabase
    .from("ai_conversations")
    .update(updates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE ?id=42 — delete a conversation
export async function DELETE(request: Request) {
  const supabase = await createSupabaseServer();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("id", Number(id));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
