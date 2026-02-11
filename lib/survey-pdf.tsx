import React from "react";
import { Document, Page, View, Text, StyleSheet, Svg, Rect } from "@react-pdf/renderer";

// NIA brand colors
const NIA_GREEN = "#b1bd37";
const NIA_ORANGE = "#e78b36";
const NIA_DARK = "#2d3748";
const NIA_GRAY = "#718096";
const NIA_LIGHT = "#f7fafc";

const BAR_COLORS = ["#e2e8f0", "#c6d06c", "#a3b734", NIA_GREEN, "#8da02e"];
const NPS_RED = "#e53e3e";
const NPS_YELLOW = "#ecc94b";
const NPS_GREEN = "#48bb78";

interface QuestionResult {
  question_text: string;
  question_type: string;
  avg_value: number;
  response_count: number;
  distribution?: number[];
  nps_score?: number;
  nps_segments?: { detractors: number; passives: number; promoters: number };
  option_counts?: number[];
  option_labels?: string[];
  text_responses?: string[];
  matrix_rows?: { row_label: string; avg_value: number }[];
  column_labels?: string[];
}

interface AiSummary {
  key_findings: string[];
  strengths: string[];
  areas_for_improvement: string[];
  notable_comments: string[];
  recommended_actions: string[];
}

interface PdfData {
  surveyTitle: string;
  processName: string;
  waveNumber: number;
  closedAt: string;
  responseCount: number;
  questions: QuestionResult[];
  summary: AiSummary | null;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: NIA_DARK,
  },
  // Cover page
  coverPage: {
    padding: 40,
    fontFamily: "Helvetica",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },
  coverAccent: {
    width: 60,
    height: 4,
    backgroundColor: NIA_GREEN,
    marginBottom: 20,
  },
  coverTitle: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: NIA_DARK,
    textAlign: "center",
    marginBottom: 8,
  },
  coverSubtitle: {
    fontSize: 14,
    color: NIA_GRAY,
    textAlign: "center",
    marginBottom: 30,
  },
  coverMeta: {
    fontSize: 11,
    color: NIA_GRAY,
    textAlign: "center",
    marginBottom: 4,
  },
  coverStats: {
    flexDirection: "row",
    gap: 30,
    marginTop: 30,
    padding: 16,
    backgroundColor: NIA_LIGHT,
    borderRadius: 4,
  },
  coverStat: {
    alignItems: "center",
  },
  coverStatValue: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: NIA_DARK,
  },
  coverStatLabel: {
    fontSize: 9,
    color: NIA_GRAY,
    marginTop: 2,
  },
  // Section headers
  sectionHeader: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: NIA_DARK,
    marginBottom: 12,
    marginTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: NIA_GREEN,
  },
  // Question cards
  questionCard: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: NIA_LIGHT,
    borderRadius: 4,
  },
  questionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: NIA_DARK,
    marginBottom: 4,
  },
  questionMeta: {
    fontSize: 8,
    color: NIA_GRAY,
    marginBottom: 8,
  },
  avgBadge: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: NIA_GREEN,
    marginBottom: 6,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  barLabel: {
    width: 100,
    fontSize: 8,
    color: NIA_GRAY,
    textAlign: "right",
    paddingRight: 6,
  },
  barCount: {
    fontSize: 8,
    color: NIA_GRAY,
    paddingLeft: 4,
  },
  // NPS
  npsScoreText: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 6,
  },
  npsSegmentRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  npsLabel: {
    fontSize: 8,
    color: NIA_GRAY,
    textAlign: "center",
    marginTop: 2,
  },
  // Text responses
  textResponse: {
    fontSize: 9,
    color: NIA_DARK,
    marginBottom: 4,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: "#e2e8f0",
  },
  // Matrix
  matrixRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  matrixLabel: {
    width: 120,
    fontSize: 8,
    color: NIA_GRAY,
    textAlign: "right",
    paddingRight: 6,
  },
  matrixValue: {
    fontSize: 8,
    color: NIA_DARK,
    paddingLeft: 4,
    fontFamily: "Helvetica-Bold",
  },
  // AI Summary
  summarySection: {
    marginBottom: 10,
  },
  summaryHeading: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: NIA_DARK,
    marginBottom: 4,
  },
  summaryBullet: {
    fontSize: 9,
    color: NIA_DARK,
    marginBottom: 3,
    paddingLeft: 10,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: NIA_GRAY,
  },
  // Options (MC/Checkbox)
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  optionLabel: {
    width: 130,
    fontSize: 8,
    color: NIA_GRAY,
    textAlign: "right",
    paddingRight: 6,
  },
  optionCount: {
    fontSize: 8,
    color: NIA_GRAY,
    paddingLeft: 4,
  },
});

function formatDate(dateStr: string): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getNpsColor(score: number): string {
  if (score < 0) return NPS_RED;
  if (score < 50) return NPS_YELLOW;
  return NPS_GREEN;
}

// Horizontal bar using SVG
function HBar({
  width,
  maxWidth,
  color,
  height = 12,
}: {
  width: number;
  maxWidth: number;
  color: string;
  height?: number;
}) {
  const barW = maxWidth > 0 ? Math.max(1, (width / maxWidth) * 200) : 0;
  return (
    <Svg width={200} height={height}>
      <Rect x={0} y={0} width={200} height={height} fill="#e2e8f0" rx={2} />
      <Rect x={0} y={0} width={barW} height={height} fill={color} rx={2} />
    </Svg>
  );
}

function RatingQuestion({ q }: { q: QuestionResult }) {
  const dist = q.distribution || [];
  const maxCount = Math.max(...dist, 1);
  return (
    <View style={styles.questionCard}>
      <Text style={styles.questionTitle}>{q.question_text}</Text>
      <Text style={styles.questionMeta}>
        Rating · {q.response_count} responses
      </Text>
      <Text style={styles.avgBadge}>
        Average: {q.avg_value.toFixed(2)} / {dist.length}
      </Text>
      {dist.map((count, i) => (
        <View key={i} style={styles.barRow}>
          <Text style={styles.barLabel}>{i + 1}</Text>
          <HBar
            width={count}
            maxWidth={maxCount}
            color={BAR_COLORS[Math.min(i, BAR_COLORS.length - 1)]}
          />
          <Text style={styles.barCount}>{count}</Text>
        </View>
      ))}
    </View>
  );
}

function NpsQuestion({ q }: { q: QuestionResult }) {
  const segments = q.nps_segments;
  const total = segments
    ? segments.detractors + segments.passives + segments.promoters
    : 0;
  return (
    <View style={styles.questionCard}>
      <Text style={styles.questionTitle}>{q.question_text}</Text>
      <Text style={styles.questionMeta}>
        NPS · {q.response_count} responses
      </Text>
      <Text style={[styles.npsScoreText, { color: getNpsColor(q.nps_score || 0) }]}>
        NPS: {q.nps_score}
      </Text>
      {segments && total > 0 && (
        <>
          <View style={styles.npsSegmentRow}>
            <Svg width={300} height={16}>
              <Rect
                x={0}
                y={0}
                width={(segments.detractors / total) * 300}
                height={16}
                fill={NPS_RED}
              />
              <Rect
                x={(segments.detractors / total) * 300}
                y={0}
                width={(segments.passives / total) * 300}
                height={16}
                fill={NPS_YELLOW}
              />
              <Rect
                x={((segments.detractors + segments.passives) / total) * 300}
                y={0}
                width={(segments.promoters / total) * 300}
                height={16}
                fill={NPS_GREEN}
              />
            </Svg>
          </View>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 2 }}>
            <Text style={styles.npsLabel}>
              Detractors: {segments.detractors} ({Math.round((segments.detractors / total) * 100)}%)
            </Text>
            <Text style={styles.npsLabel}>
              Passives: {segments.passives} ({Math.round((segments.passives / total) * 100)}%)
            </Text>
            <Text style={styles.npsLabel}>
              Promoters: {segments.promoters} ({Math.round((segments.promoters / total) * 100)}%)
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

function YesNoQuestion({ q }: { q: QuestionResult }) {
  const yesPercent = q.avg_value;
  return (
    <View style={styles.questionCard}>
      <Text style={styles.questionTitle}>{q.question_text}</Text>
      <Text style={styles.questionMeta}>
        Yes/No · {q.response_count} responses
      </Text>
      <Text style={styles.avgBadge}>{yesPercent}% Yes</Text>
      <View style={styles.barRow}>
        <Text style={styles.barLabel}>Yes</Text>
        <HBar width={yesPercent} maxWidth={100} color={NIA_GREEN} />
        <Text style={styles.barCount}>{yesPercent}%</Text>
      </View>
      <View style={styles.barRow}>
        <Text style={styles.barLabel}>No</Text>
        <HBar width={100 - yesPercent} maxWidth={100} color="#e53e3e" />
        <Text style={styles.barCount}>{100 - yesPercent}%</Text>
      </View>
    </View>
  );
}

function ChoiceQuestion({ q }: { q: QuestionResult }) {
  const labels = q.option_labels || [];
  const counts = q.option_counts || [];
  const maxCount = Math.max(...counts, 1);
  const total = counts.reduce((s, c) => s + c, 0);
  return (
    <View style={styles.questionCard}>
      <Text style={styles.questionTitle}>{q.question_text}</Text>
      <Text style={styles.questionMeta}>
        {q.question_type === "checkbox" ? "Checkbox" : "Multiple Choice"} ·{" "}
        {q.response_count} responses
      </Text>
      {labels.map((label, i) => {
        const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
        return (
          <View key={i} style={styles.optionRow}>
            <Text style={styles.optionLabel}>{label}</Text>
            <HBar width={counts[i]} maxWidth={maxCount} color={NIA_ORANGE} />
            <Text style={styles.optionCount}>
              {counts[i]} ({pct}%)
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function OpenTextQuestion({ q }: { q: QuestionResult }) {
  const texts = q.text_responses || [];
  return (
    <View style={styles.questionCard}>
      <Text style={styles.questionTitle}>{q.question_text}</Text>
      <Text style={styles.questionMeta}>
        Open Text · {q.response_count} responses
      </Text>
      {texts.length > 0 ? (
        texts.map((text, i) => (
          <Text key={i} style={styles.textResponse}>
            &quot;{text}&quot;
          </Text>
        ))
      ) : (
        <Text style={styles.textResponse}>No text responses</Text>
      )}
    </View>
  );
}

function MatrixQuestion({ q }: { q: QuestionResult }) {
  const rows = q.matrix_rows || [];
  const maxVal = rows.length > 0 ? Math.max(...rows.map((r) => r.avg_value), 1) : 1;
  return (
    <View style={styles.questionCard}>
      <Text style={styles.questionTitle}>{q.question_text}</Text>
      <Text style={styles.questionMeta}>
        Matrix · {q.response_count} responses
      </Text>
      {rows.map((row, i) => (
        <View key={i} style={styles.matrixRow}>
          <Text style={styles.matrixLabel}>{row.row_label}</Text>
          <HBar width={row.avg_value} maxWidth={maxVal} color={NIA_GREEN} />
          <Text style={styles.matrixValue}>{row.avg_value.toFixed(2)}</Text>
        </View>
      ))}
    </View>
  );
}

function QuestionSection({ q }: { q: QuestionResult }) {
  switch (q.question_type) {
    case "rating":
      return <RatingQuestion q={q} />;
    case "nps":
      return <NpsQuestion q={q} />;
    case "yes_no":
      return <YesNoQuestion q={q} />;
    case "multiple_choice":
    case "checkbox":
      return <ChoiceQuestion q={q} />;
    case "open_text":
      return <OpenTextQuestion q={q} />;
    case "matrix":
      return <MatrixQuestion q={q} />;
    default:
      return (
        <View style={styles.questionCard}>
          <Text style={styles.questionTitle}>{q.question_text}</Text>
          <Text style={styles.questionMeta}>
            {q.response_count} responses · Avg: {q.avg_value.toFixed(2)}
          </Text>
        </View>
      );
  }
}

function AiSummarySection({ summary }: { summary: AiSummary }) {
  const sections: { title: string; items: string[] }[] = [
    { title: "Key Findings", items: summary.key_findings },
    { title: "Strengths", items: summary.strengths },
    { title: "Areas for Improvement", items: summary.areas_for_improvement },
    { title: "Notable Comments", items: summary.notable_comments },
    { title: "Recommended Actions", items: summary.recommended_actions },
  ];

  return (
    <View>
      <Text style={styles.sectionHeader}>AI Executive Summary</Text>
      {sections.map((sec) =>
        sec.items && sec.items.length > 0 ? (
          <View key={sec.title} style={styles.summarySection}>
            <Text style={styles.summaryHeading}>{sec.title}</Text>
            {sec.items.map((item, i) => (
              <Text key={i} style={styles.summaryBullet}>
                • {item}
              </Text>
            ))}
          </View>
        ) : null
      )}
    </View>
  );
}

export function SurveyPdfDocument(data: PdfData) {
  return (
    <Document
      title={`${data.surveyTitle} - Round ${data.waveNumber} Report`}
      author="NIA Excellence Hub"
    >
      {/* Cover Page */}
      <Page size="LETTER" style={styles.coverPage}>
        <View style={styles.coverAccent} />
        <Text style={styles.coverTitle}>{data.surveyTitle}</Text>
        {data.processName && (
          <Text style={styles.coverSubtitle}>{data.processName}</Text>
        )}
        <Text style={styles.coverMeta}>
          Round {data.waveNumber} Results Report
        </Text>
        <Text style={styles.coverMeta}>{formatDate(data.closedAt)}</Text>
        <View style={styles.coverStats}>
          <View style={styles.coverStat}>
            <Text style={styles.coverStatValue}>{data.responseCount}</Text>
            <Text style={styles.coverStatLabel}>Responses</Text>
          </View>
          <View style={styles.coverStat}>
            <Text style={styles.coverStatValue}>{data.questions.length}</Text>
            <Text style={styles.coverStatLabel}>Questions</Text>
          </View>
          <View style={styles.coverStat}>
            <Text style={styles.coverStatValue}>
              Round {data.waveNumber}
            </Text>
            <Text style={styles.coverStatLabel}>Wave</Text>
          </View>
        </View>
        <View style={styles.footer}>
          <Text>NIA Excellence Hub</Text>
          <Text>Generated {formatDate(new Date().toISOString())}</Text>
        </View>
      </Page>

      {/* Results Pages */}
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.sectionHeader}>Question Results</Text>
        {data.questions.map((q, i) => (
          <QuestionSection key={i} q={q} />
        ))}

        {/* AI Summary */}
        {data.summary && <AiSummarySection summary={data.summary} />}

        <View style={styles.footer} fixed>
          <Text>{data.surveyTitle} — Round {data.waveNumber}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
