import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES_PER_TASK = 10;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

// ── Per-user rate limiter ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS = 20;
const WINDOW_MS = 60 * 1000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_REQUESTS) return false;
  entry.count++;
  return true;
}

/**
 * GET /api/tasks/[id]/attachments — list attachments with signed download URLs
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  const { data: attachments, error } = await supabase
    .from("task_attachments")
    .select("*")
    .eq("task_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Generate signed URLs (1-hour expiry) using service role client
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (serviceUrl && serviceKey && attachments && attachments.length > 0) {
    const serviceClient = createClient(serviceUrl, serviceKey);
    const paths = attachments.map((a) => a.storage_path);
    const { data: signedUrls } = await serviceClient.storage
      .from("task-attachments")
      .createSignedUrls(paths, 3600);

    if (signedUrls) {
      for (let i = 0; i < attachments.length; i++) {
        const signed = signedUrls.find((s) => s.path === attachments[i].storage_path);
        (attachments[i] as Record<string, unknown>).url = signed?.signedUrl || null;
      }
    }
  }

  return NextResponse.json(attachments);
}

/**
 * POST /api/tasks/[id]/attachments — upload a file attachment
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  // Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  // Check attachment count limit
  const { count } = await supabase
    .from("task_attachments")
    .select("id", { count: "exact", head: true })
    .eq("task_id", id);

  if ((count || 0) >= MAX_FILES_PER_TASK) {
    return NextResponse.json(
      { error: `Maximum ${MAX_FILES_PER_TASK} files per task` },
      { status: 400 }
    );
  }

  // Parse form data
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 10MB." },
      { status: 400 }
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "File type not allowed. Accepted: images, PDF, Word, text." },
      { status: 400 }
    );
  }

  // Upload to Supabase Storage using service role (bypasses RLS on storage)
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceUrl || !serviceKey) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }

  const serviceClient = createClient(serviceUrl, serviceKey);
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `tasks/${id}/${timestamp}_${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await serviceClient.storage
    .from("task-attachments")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: "Upload failed: " + uploadError.message },
      { status: 500 }
    );
  }

  // Get uploader name
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("full_name")
    .eq("user_id", user.id)
    .single();
  const userName = roleRow?.full_name || user.email || "Unknown";

  // Insert metadata row
  const { data: attachment, error: insertError } = await supabase
    .from("task_attachments")
    .insert({
      task_id: id,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      storage_path: storagePath,
      uploaded_by: user.id,
      uploaded_by_name: userName,
    })
    .select("*")
    .single();

  if (insertError) {
    // Clean up the uploaded file
    await serviceClient.storage.from("task-attachments").remove([storagePath]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Log activity (best-effort)
  await supabase.from("task_activity_log").insert({
    task_id: id,
    user_id: user.id,
    user_name: userName,
    action: "attachment_added",
    detail: { file_name: file.name },
  });

  return NextResponse.json(attachment, { status: 201 });
}

/**
 * DELETE /api/tasks/[id]/attachments — remove an attachment
 * Body: { attachment_id: number }
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();

  // Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const attachmentId = Number(body.attachment_id);
  if (!attachmentId || isNaN(attachmentId)) {
    return NextResponse.json({ error: "Invalid attachment_id" }, { status: 400 });
  }

  // Fetch the attachment to get storage path
  const { data: attachment, error: fetchError } = await supabase
    .from("task_attachments")
    .select("id, storage_path, file_name")
    .eq("id", attachmentId)
    .eq("task_id", id)
    .single();

  if (fetchError || !attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  // Delete from storage
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceUrl && serviceKey) {
    const serviceClient = createClient(serviceUrl, serviceKey);
    await serviceClient.storage
      .from("task-attachments")
      .remove([attachment.storage_path]);
  }

  // Delete metadata row
  const { error: deleteError } = await supabase
    .from("task_attachments")
    .delete()
    .eq("id", attachmentId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Log activity (best-effort)
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("full_name")
    .eq("user_id", user.id)
    .single();
  const userName = roleRow?.full_name || user.email || "Unknown";

  await supabase.from("task_activity_log").insert({
    task_id: id,
    user_id: user.id,
    user_name: userName,
    action: "attachment_removed",
    detail: { file_name: attachment.file_name },
  });

  return NextResponse.json({ success: true });
}
