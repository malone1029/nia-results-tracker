import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Path to the Obsidian vault process files
const VAULT_PROCESSES_DIR = path.join(
  process.env.HOME || '/Users/jonmalone',
  'Documents/Malone Remote Vault/NIA-Excellence/Processes'
);

// Files/folders to skip
const SKIP = new Set(['Process-Template.md', 'Quick-Process-Template.md', 'Session-Tracker.md']);
const SKIP_DIRS = new Set(['Tools', 'Process-Development-Sessions']);

interface VaultFile {
  name: string; // Display name (without .md, dashes → spaces)
  relativePath: string; // Path relative to Processes dir
  category: string; // Parent folder name (e.g., "1-Leadership")
}

async function findProcessFiles(dir: string, basePath: string = ''): Promise<VaultFile[]> {
  const results: VaultFile[] = [];

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const subPath = basePath ? `${basePath}/${entry.name}` : entry.name;
      const subResults = await findProcessFiles(path.join(dir, entry.name), subPath);
      results.push(...subResults);
    } else if (entry.name.endsWith('.md') && !SKIP.has(entry.name)) {
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
      const displayName = entry.name.replace(/\.md$/, '').replace(/-/g, ' ').replace(/^\d+-/, ''); // Remove leading number prefix like "1-"

      // Category is the top-level folder, or "root" if in the Processes dir itself
      const category = basePath ? basePath.split('/')[0] : 'root';

      results.push({
        name: displayName,
        relativePath,
        category,
      });
    }
  }

  return results;
}

export async function GET() {
  try {
    const files = await findProcessFiles(VAULT_PROCESSES_DIR);

    // Sort by category, then name
    files.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ files, vaultPath: VAULT_PROCESSES_DIR });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read vault: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
