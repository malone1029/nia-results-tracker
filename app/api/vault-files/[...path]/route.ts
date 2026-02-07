import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const VAULT_PROCESSES_DIR = path.join(
  process.env.HOME || "/Users/jonmalone",
  "Documents/Malone Remote Vault/NIA-Excellence/Processes"
);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const filePath = path.join(VAULT_PROCESSES_DIR, ...segments);

  // Security: ensure the resolved path is within the vault directory
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(VAULT_PROCESSES_DIR))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const content = await fs.readFile(resolved, "utf-8");
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json(
      { error: "File not found" },
      { status: 404 }
    );
  }
}
