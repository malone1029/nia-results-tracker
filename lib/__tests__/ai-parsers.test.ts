import { describe, it, expect } from "vitest";
import {
  parseAdliScores,
  parseCoachSuggestions,
  parseProposedTasks,
  parseMetricSuggestions,
  stripPartialBlocks,
  hasPartialBlock,
  FIELD_LABELS,
} from "../ai-parsers";

describe("parseAdliScores", () => {
  it("extracts scores from a valid adli-scores block", () => {
    const text = `Here is the assessment:\n\`\`\`adli-scores\n{"approach":70,"deployment":55,"learning":40,"integration":60}\n\`\`\`\nOverall analysis follows.`;
    const { scores, cleanedText } = parseAdliScores(text);
    expect(scores).toEqual({ approach: 70, deployment: 55, learning: 40, integration: 60 });
    expect(cleanedText).toBe("Here is the assessment:\nOverall analysis follows.");
  });

  it("returns null scores when no block is present", () => {
    const text = "Just a regular message with no scores.";
    const { scores, cleanedText } = parseAdliScores(text);
    expect(scores).toBeNull();
    expect(cleanedText).toBe(text);
  });

  it("returns null scores on malformed JSON", () => {
    const text = "```adli-scores\n{broken json}\n```";
    const { scores, cleanedText } = parseAdliScores(text);
    expect(scores).toBeNull();
    expect(cleanedText).toBe(text);
  });
});

describe("parseCoachSuggestions", () => {
  it("extracts suggestions from a valid block", () => {
    const json = JSON.stringify([
      { id: "s1", field: "charter", priority: "quick-win", effort: "minimal", title: "Improve charter", whyMatters: "Clarity", preview: "...", content: "New charter text" },
    ]);
    const text = `Analysis:\n\`\`\`coach-suggestions\n${json}\n\`\`\`\nDone.`;
    const { suggestions, cleanedText } = parseCoachSuggestions(text);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].id).toBe("s1");
    expect(suggestions[0].field).toBe("charter");
    expect(cleanedText).toBe("Analysis:\nDone.");
  });

  it("handles legacy adli-suggestion format", () => {
    const json = JSON.stringify({ field: "charter", content: "Updated charter" });
    const text = `\`\`\`adli-suggestion\n${json}\n\`\`\``;
    const { suggestions } = parseCoachSuggestions(text);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].id).toBe("legacy");
    expect(suggestions[0].field).toBe("charter");
  });

  it("returns empty array when no block found", () => {
    const { suggestions, cleanedText } = parseCoachSuggestions("Just text");
    expect(suggestions).toHaveLength(0);
    expect(cleanedText).toBe("Just text");
  });

  it("handles nested backticks in content (mermaid diagrams)", () => {
    // The greedy regex should match the LAST closing ```
    const inner = JSON.stringify([
      { id: "s1", field: "workflow", priority: "important", effort: "moderate", title: "Add map", whyMatters: "Visual", preview: "...", content: "```mermaid\ngraph TD\nA-->B\n```" },
    ]);
    const text = `\`\`\`coach-suggestions\n${inner}\n\`\`\``;
    const { suggestions } = parseCoachSuggestions(text);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].content).toContain("mermaid");
  });
});

describe("parseProposedTasks", () => {
  it("extracts tasks from a valid block", () => {
    const tasks = [
      { title: "Create survey", description: "Design quarterly survey", pdcaSection: "plan", adliDimension: "learning" },
    ];
    const text = `\`\`\`proposed-tasks\n${JSON.stringify(tasks)}\n\`\`\``;
    const { tasks: parsed } = parseProposedTasks(text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe("Create survey");
    expect(parsed[0].pdcaSection).toBe("plan");
  });

  it("returns empty array on no block", () => {
    const { tasks } = parseProposedTasks("no tasks here");
    expect(tasks).toHaveLength(0);
  });
});

describe("parseMetricSuggestions", () => {
  it("extracts metric suggestions", () => {
    const metrics = [
      { action: "link", metricId: 42, name: "Response Time", unit: "hours", cadence: "monthly", reason: "Track speed" },
    ];
    const text = `\`\`\`metric-suggestions\n${JSON.stringify(metrics)}\n\`\`\``;
    const { metrics: parsed } = parseMetricSuggestions(text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].action).toBe("link");
    expect(parsed[0].metricId).toBe(42);
  });
});

describe("stripPartialBlocks", () => {
  it("removes complete structured blocks", () => {
    const text = `Intro.\n\`\`\`adli-scores\n{"approach":50}\n\`\`\`\nConclusion.`;
    expect(stripPartialBlocks(text)).toBe("Intro.\nConclusion.");
  });

  it("removes partial (still-streaming) blocks", () => {
    const text = "Starting analysis...\n```adli-scores\n{\"approach\":";
    expect(stripPartialBlocks(text)).toBe("Starting analysis...");
  });

  it("handles text with no blocks", () => {
    expect(stripPartialBlocks("Just text")).toBe("Just text");
  });
});

describe("hasPartialBlock", () => {
  it("detects partial adli-scores block", () => {
    expect(hasPartialBlock("text\n```adli-scores\n{partial")).toBe("scores");
  });

  it("detects partial coach-suggestions block", () => {
    expect(hasPartialBlock("text\n```coach-suggestions\n[{")).toBe("suggestions");
  });

  it("detects partial proposed-tasks block", () => {
    expect(hasPartialBlock("text\n```proposed-tasks\n[")).toBe("tasks");
  });

  it("detects partial metric-suggestions block", () => {
    expect(hasPartialBlock("text\n```metric-suggestions\n[")).toBe("metrics");
  });

  it("returns null for complete blocks", () => {
    expect(hasPartialBlock("```adli-scores\n{}\n```")).toBeNull();
  });

  it("returns null for plain text", () => {
    expect(hasPartialBlock("just regular text")).toBeNull();
  });
});

describe("FIELD_LABELS", () => {
  it("has labels for all expected fields", () => {
    expect(FIELD_LABELS.charter).toBe("Charter");
    expect(FIELD_LABELS.adli_approach).toBe("ADLI: Approach");
    expect(FIELD_LABELS.workflow).toBe("Process Map");
  });
});
