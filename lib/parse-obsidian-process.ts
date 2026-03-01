// Parser for Obsidian process markdown documents
// Handles both Full (ADLI) and Quick templates

import type {
  ProcessStatus,
  ProcessType,
  Charter,
  AdliApproach,
  AdliDeployment,
  AdliLearning,
  AdliIntegration,
  Workflow,
} from './types';

export interface ParsedProcess {
  name: string;
  status: ProcessStatus;
  template_type: 'full';
  owner: string | null;
  reviewer: string | null;
  baldrige_category: string | null; // display name like "Leadership"
  baldrige_item: string | null;
  description: string | null;
  basic_steps: string[];
  participants: string[];
  metrics_summary: string | null;
  connections: string | null;
  charter: Charter | null;
  adli_approach: AdliApproach | null;
  adli_deployment: AdliDeployment | null;
  adli_learning: AdliLearning | null;
  adli_integration: AdliIntegration | null;
  workflow: Workflow | null;
  process_type: ProcessType;
}

// Map status emoji/text to our status values
function parseStatus(raw: string): ProcessStatus {
  const lower = raw.toLowerCase().trim();
  if (lower.includes('approved')) return 'approved';
  if (
    lower.includes('ready for review') ||
    lower.includes('ready_for_review') ||
    lower.includes('review')
  )
    return 'ready_for_review';
  return 'draft';
}

// Map category string from frontmatter to display name
const CATEGORY_MAP: Record<string, string> = {
  '1': 'Leadership',
  '2': 'Strategy',
  '3': 'Customers',
  '4': 'Measurement, Analysis & Knowledge Management',
  '5': 'Workforce',
  '6': 'Operations',
};

// Extract text between two headings at a given level
function extractSection(lines: string[], heading: string, level: number = 2): string[] {
  const prefix = '#'.repeat(level) + ' ';
  const sameOrHigher = new RegExp(`^#{1,${level}} `);
  let collecting = false;
  const result: string[] = [];

  for (const line of lines) {
    if (collecting) {
      if (sameOrHigher.test(line) && !line.startsWith(prefix + heading)) {
        break;
      }
      result.push(line);
    } else if (line.startsWith(prefix) && line.toLowerCase().includes(heading.toLowerCase())) {
      collecting = true;
    }
  }
  return result;
}

// Extract subsection under a ### heading within given lines
function extractSubSection(lines: string[], heading: string): string[] {
  let collecting = false;
  const result: string[] = [];

  for (const line of lines) {
    if (collecting) {
      if (/^#{2,3} /.test(line)) break;
      result.push(line);
    } else if (line.startsWith('### ') && line.toLowerCase().includes(heading.toLowerCase())) {
      collecting = true;
    }
  }
  return result;
}

// Clean bullet points: remove "- ", "* ", leading whitespace, bold markers
function cleanBullets(lines: string[]): string[] {
  return lines
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- ') || l.startsWith('* '))
    .map((l) =>
      l
        .replace(/^[-*]\s+/, '')
        .replace(/\*\*/g, '')
        .trim()
    )
    .filter(Boolean);
}

// Extract numbered list items
function cleanNumbered(lines: string[]): string[] {
  return lines
    .map((l) => l.trim())
    .filter((l) => /^\d+[.)]\s/.test(l))
    .map((l) => l.replace(/^\d+[.)]\s+/, '').trim())
    .filter(Boolean);
}

// Get paragraph text (non-heading, non-list, non-empty lines)
function extractParagraph(lines: string[]): string {
  return lines
    .filter(
      (l) =>
        l.trim() &&
        !l.startsWith('#') &&
        !l.startsWith('- ') &&
        !l.startsWith('* ') &&
        !l.startsWith('**') &&
        !l.startsWith('---') &&
        !l.startsWith('<!--') &&
        !l.startsWith('>') &&
        !l.startsWith('```') &&
        !l.startsWith('| ') &&
        !/^\d+[.)]\s/.test(l.trim())
    )
    .map((l) => l.replace(/^\*[^*]+\*$/, '').trim()) // Remove italic instructions
    .filter(Boolean)
    .join('\n')
    .trim();
}

// Convert section lines to a single markdown string, preserving all formatting.
// Strips italic-only instruction lines (like "*Why this process exists...*")
// and leading/trailing blank lines and horizontal rules.
function sectionToMarkdown(lines: string[]): string {
  return lines
    .filter((l) => !/^\*[^*]+\*$/.test(l.trim())) // Remove italic-only instruction lines
    .join('\n')
    .replace(/^[\s\n]*---[\s\n]*/, '') // Strip leading horizontal rule
    .replace(/[\s\n]*---[\s\n]*$/, '') // Strip trailing horizontal rule
    .trim();
}

// Extract labeled value like "- Includes: ..." or "- Primary Owner: ..."
function extractLabeled(lines: string[], label: string): string {
  for (const line of lines) {
    const trimmed = line.trim().replace(/^[-*]\s+/, '');
    if (trimmed.toLowerCase().startsWith(label.toLowerCase())) {
      return trimmed.substring(label.length).replace(/^:\s*/, '').trim();
    }
  }
  return '';
}

// Extract all bullet content after a bold label like **Evidence-Based Foundation:**
function extractAfterBold(lines: string[], boldLabel: string): string[] {
  let collecting = false;
  const result: string[] = [];

  for (const line of lines) {
    if (collecting) {
      const trimmed = line.trim();
      if (trimmed.startsWith('**') && trimmed.endsWith(':**')) break;
      if (trimmed.startsWith('---')) break;
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const clean = trimmed.replace(/^[-*]\s+/, '').trim();
        if (clean) result.push(clean);
      }
    } else if (line.toLowerCase().includes(boldLabel.toLowerCase())) {
      collecting = true;
    }
  }
  return result;
}

// Extract metadata from bold-label lines in the body text
// These appear when copying from Obsidian's reading view (no frontmatter)
// Patterns like: **Status**: 🔴 Draft, **Owner**: Jon Malone, CEO
function extractBodyMetadata(lines: string[]): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (const line of lines) {
    // Match **Label**: Value or **Label:** Value
    const match = line.match(/^\*\*([^*]+)\*\*:\s*(.+)$/);
    if (match) {
      const key = match[1].trim().toLowerCase();
      // Strip emoji indicators (🔴, 🟠, 🟡, 🟣, 🟢) from values
      const value = match[2].replace(/[🔴🟠🟡🟣🟢]\s*/g, '').trim();
      metadata[key] = value;
    }
  }
  return metadata;
}

// Parse a Baldrige category string like "3 - Customers" or "1 (Leadership)" to just the number
function parseBaldrigeCategory(raw: string): string {
  const numMatch = raw.match(/^(\d)/);
  return numMatch ? numMatch[1] : raw;
}

// Strip Obsidian wiki-links: [[Some-Link|Display]] → Display, [[Some-Link]] → Some Link
function stripWikiLinks(text: string): string {
  return text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2') // [[target|display]] → display
    .replace(
      /\[\[([^\]]+)\]\]/g,
      (_match, link: string) => link.replace(/-/g, ' ') // [[Some-Link]] → Some Link
    );
}

export function parseObsidianProcess(markdown: string): ParsedProcess {
  // Strip wiki-links from the entire input before parsing
  const cleaned = stripWikiLinks(markdown);
  const lines = cleaned.split('\n');

  // ── Parse YAML frontmatter ──
  let frontmatter: Record<string, string> = {};
  if (lines[0]?.trim() === '---') {
    const endIdx = lines.indexOf('---', 1);
    if (endIdx > 0) {
      const yamlLines = lines.slice(1, endIdx);
      for (const yl of yamlLines) {
        const match = yl.match(/^(\S[\w-]+):\s*(.*)$/);
        if (match) {
          frontmatter[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
        }
      }
    }
  }

  // ── Fallback: extract metadata from body text (bold-label lines) ──
  // When copying from Obsidian reading view, frontmatter is lost but
  // the body has lines like **Status**: 🔴 Draft, **Owner**: Jon Malone
  const bodyMeta = extractBodyMetadata(lines);

  // ── Extract process name from # heading ──
  const titleLine = lines.find((l) => /^# /.test(l));
  const name = titleLine ? titleLine.replace(/^# /, '').trim() : 'Untitled Process';

  // ── Detect document structure ──
  const hasADLI = lines.some(
    (l) => l.startsWith('## ADLI Framework') || l.startsWith('### Approach')
  );
  const hasCharter = lines.some((l) => l.startsWith('## Process Charter'));
  const isQuick = lines.some((l) => l.startsWith('## What is this process?'));

  // ── Parse status (frontmatter first, then body fallback) ──
  const statusRaw = frontmatter['status'] || bodyMeta['status'] || '';
  const status = parseStatus(statusRaw);

  // ── Parse owner (frontmatter first, then body fallback) ──
  const owner = frontmatter['owner'] || bodyMeta['owner'] || null;
  const reviewer = frontmatter['reviewer'] || bodyMeta['reviewer'] || null;

  // ── Parse Baldrige info (frontmatter first, then body fallback) ──
  const catRaw =
    frontmatter['baldrige-category'] ||
    (bodyMeta['baldrige category'] ? parseBaldrigeCategory(bodyMeta['baldrige category']) : '') ||
    '';
  const baldrige_category = CATEGORY_MAP[catRaw] || catRaw || null;
  const baldrige_item = frontmatter['baldrige-item'] || bodyMeta['baldrige item'] || null;

  // ── Extract full body content (everything after frontmatter and title) ──
  // Used as fallback when document doesn't match any template structure
  let bodyStartIdx = 0;
  if (lines[0]?.trim() === '---') {
    const endIdx = lines.indexOf('---', 1);
    if (endIdx > 0) bodyStartIdx = endIdx + 1;
  }
  // Skip blank lines and the title line
  while (bodyStartIdx < lines.length && !lines[bodyStartIdx]?.trim()) bodyStartIdx++;
  if (lines[bodyStartIdx]?.startsWith('# ')) bodyStartIdx++;
  const bodyLines = lines.slice(bodyStartIdx);
  const fullBody = sectionToMarkdown(bodyLines);

  // ── Quick template fields ──
  let description: string | null = null;
  let basic_steps: string[] = [];
  let participants: string[] = [];
  let metrics_summary: string | null = null;
  let connections: string | null = null;

  if (isQuick) {
    const descSection = extractSection(lines, 'What is this process');
    description = extractParagraph(descSection) || null;

    const stepsSection = extractSection(lines, 'How do we do it');
    basic_steps = cleanNumbered(stepsSection);
    if (basic_steps.length === 0) basic_steps = cleanBullets(stepsSection);

    const whoSection = extractSection(lines, "Who's involved");
    const partLine = extractLabeled(whoSection, 'Participants');
    participants = partLine
      ? partLine
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)
      : cleanBullets(whoSection);
    const ownerLine = extractLabeled(whoSection, 'Owner');
    if (ownerLine && !owner) {
      // Use as owner fallback
    }

    const metricsSection = extractSection(lines, "How do we know it's working");
    metrics_summary =
      cleanBullets(metricsSection).join('; ') || extractParagraph(metricsSection) || null;

    const connSection = extractSection(lines, 'What does this connect to');
    connections = cleanBullets(connSection).join('; ') || extractParagraph(connSection) || null;
  }

  // ── Charter ──
  let charter: Charter | null = null;
  if (hasCharter) {
    const charterLines = extractSection(lines, 'Process Charter');
    const purposeLines = extractSubSection(charterLines, 'Purpose');
    const scopeLines = extractSubSection(charterLines, 'Scope');
    const stakeholderLines = extractSubSection(charterLines, 'Key Stakeholders');
    const missionLines = extractSubSection(charterLines, 'Mission Alignment');

    charter = {
      content: sectionToMarkdown(charterLines) || undefined,
      purpose: sectionToMarkdown(purposeLines) || undefined,
      scope_includes:
        sectionToMarkdown(extractSubSection(scopeLines, 'Includes')) ||
        extractLabeled(scopeLines, 'Includes') ||
        undefined,
      scope_excludes:
        sectionToMarkdown(extractSubSection(scopeLines, 'Excludes')) ||
        extractLabeled(scopeLines, 'Excludes') ||
        undefined,
      stakeholders: cleanBullets(stakeholderLines).filter(Boolean),
      mission_alignment: sectionToMarkdown(missionLines) || undefined,
    };

    // Populate description with clean paragraph text from purpose (not the full markdown)
    if (!description) {
      description = extractParagraph(purposeLines) || null;
    }
  }

  // ── ADLI ──
  let adli_approach: AdliApproach | null = null;
  let adli_deployment: AdliDeployment | null = null;
  let adli_learning: AdliLearning | null = null;
  let adli_integration: AdliIntegration | null = null;

  if (hasADLI) {
    // Approach — capture full section markdown + best-effort structured fields
    const approachLines = extractSection(lines, 'Approach', 3);
    adli_approach = {
      content: sectionToMarkdown(approachLines) || undefined,
      evidence_base:
        extractAfterBold(approachLines, 'Evidence-Based Foundation').join('\n') || undefined,
      key_steps:
        cleanNumbered(approachLines).length > 0
          ? cleanNumbered(approachLines)
          : cleanBullets(approachLines.slice(0, 20)),
      tools_used: extractAfterBold(approachLines, 'Tools/Technology').filter(Boolean),
      key_requirements: extractAfterBold(approachLines, 'Key Requirements').join('\n') || undefined,
    };

    // Deployment — capture full section markdown
    const deployLines = extractSection(lines, 'Deployment', 3);
    adli_deployment = {
      content: sectionToMarkdown(deployLines) || undefined,
      teams: extractAfterBold(deployLines, 'Deployment Across Organization').filter(Boolean),
      communication_plan: extractLabeled(deployLines, 'How process is communicated') || undefined,
      training_approach: extractLabeled(deployLines, 'Training/onboarding') || undefined,
      consistency_mechanisms:
        extractAfterBold(deployLines, 'Consistency Mechanisms').join('\n') || undefined,
    };

    // Learning — capture full section markdown
    const learningLines = extractSection(lines, 'Learning', 3);
    adli_learning = {
      content: sectionToMarkdown(learningLines) || undefined,
      metrics: extractAfterBold(learningLines, 'Evaluation Methods').filter(Boolean),
      evaluation_methods: extractLabeled(learningLines, 'Review frequency') || undefined,
      review_frequency: extractLabeled(learningLines, 'Review frequency') || undefined,
      improvement_process:
        extractAfterBold(learningLines, 'Improvement Mechanisms').join('\n') || undefined,
    };

    // Integration — capture full section markdown
    const integrationLines = extractSection(lines, 'Integration', 3);
    adli_integration = {
      content: sectionToMarkdown(integrationLines) || undefined,
      strategic_goals: extractAfterBold(integrationLines, 'Connection to Strategic').filter(
        Boolean
      ),
      mission_connection:
        extractLabeled(integrationLines, 'How this process advances') || undefined,
      related_processes: extractAfterBold(integrationLines, 'Integration with Other').filter(
        Boolean
      ),
      standards_alignment:
        extractAfterBold(integrationLines, 'Alignment Mechanisms').join('\n') || undefined,
    };
  }

  // ── Workflow ──
  let workflow: Workflow | null = null;
  const workflowSection = extractSection(lines, 'Detailed Process Workflow');
  if (workflowSection.length > 0) {
    const inputLines = extractSubSection(workflowSection, 'Input Requirements');
    const outputLines = extractSubSection(workflowSection, 'Output');
    const qcLines = extractSubSection(workflowSection, 'Quality Controls');

    workflow = {
      content: sectionToMarkdown(workflowSection) || undefined,
      inputs: cleanBullets(inputLines).filter(Boolean),
      steps: [],
      outputs: cleanBullets(outputLines).filter(Boolean),
      quality_controls: cleanBullets(qcLines).filter(Boolean),
    };
  }

  // ── Fallback: document doesn't match any template structure ──
  // Store the full body so the content isn't lost
  if (!description && !charter && !adli_approach && fullBody) {
    // Grab first paragraph as description
    const firstPara = extractParagraph(bodyLines);
    description = firstPara || null;

    // Store entire body as charter content so it renders with MarkdownContent
    charter = { content: fullBody };
  }

  return {
    name,
    status,
    template_type: 'full' as const,
    owner,
    reviewer,
    baldrige_category,
    baldrige_item,
    description,
    basic_steps,
    participants,
    metrics_summary,
    connections,
    charter,
    adli_approach,
    adli_deployment,
    adli_learning,
    adli_integration,
    workflow,
    process_type: 'unclassified',
  };
}
