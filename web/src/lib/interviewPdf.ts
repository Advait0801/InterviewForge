import { jsPDF } from "jspdf";

import type { InterviewMessage, InterviewReport } from "./api";

const STAGE_LABELS: Record<string, string> = {
  behavioral: "Behavioral",
  coding: "Coding",
  system_design: "System Design",
  core_cs: "Core CS",
};

function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

export function downloadInterviewPdf(opts: {
  report: InterviewReport;
  messages: InterviewMessage[];
  companyLabel: string;
}): void {
  const { report, messages, companyLabel } = opts;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - margin * 2;
  let y = 56;
  const lh = 14;

  doc.setFontSize(18);
  doc.text("InterviewForge — Session Report", margin, y);
  y += 32;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  y = addWrappedText(doc, `Company: ${companyLabel}`, margin, y, maxW, lh);
  y += 8;
  y = addWrappedText(doc, `Session ID: ${report.sessionId}`, margin, y, maxW, lh);
  y += 8;
  y = addWrappedText(doc, `Overall score: ${report.overallScore} / 10`, margin, y, maxW, lh);

  y += 20;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Stage scores", margin, y);
  y += 22;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  if (report.stageScores && Object.keys(report.stageScores).length > 0) {
    for (const [stage, data] of Object.entries(report.stageScores)) {
      const label = STAGE_LABELS[stage] ?? stage;
      const score = typeof data.score === "string" ? parseInt(data.score, 10) : data.score;
      const line = `${label}: ${score}/10 — ${data.feedback || ""}`;
      if (y > doc.internal.pageSize.getHeight() - 80) {
        doc.addPage();
        y = 56;
      }
      y = addWrappedText(doc, line, margin, y, maxW, lh) + 6;
    }
  } else {
    y = addWrappedText(doc, "(No per-stage scores in report.)", margin, y, maxW, lh);
  }

  y += 16;
  if (y > doc.internal.pageSize.getHeight() - 100) {
    doc.addPage();
    y = 56;
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Strengths", margin, y);
  y += 20;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  for (const s of report.strengths ?? []) {
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 56;
    }
    y = addWrappedText(doc, `• ${s}`, margin, y, maxW, lh) + 4;
  }

  y += 12;
  if (y > doc.internal.pageSize.getHeight() - 80) {
    doc.addPage();
    y = 56;
  }
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Areas for improvement", margin, y);
  y += 20;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  for (const w of report.weaknesses ?? []) {
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 56;
    }
    y = addWrappedText(doc, `• ${w}`, margin, y, maxW, lh) + 4;
  }

  y += 12;
  if (y > doc.internal.pageSize.getHeight() - 80) {
    doc.addPage();
    y = 56;
  }
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Recommendations", margin, y);
  y += 20;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  for (const r of report.recommendations ?? []) {
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 56;
    }
    y = addWrappedText(doc, `• ${r}`, margin, y, maxW, lh) + 4;
  }

  y += 24;
  if (y > doc.internal.pageSize.getHeight() - 100) {
    doc.addPage();
    y = 56;
  }
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Transcript", margin, y);
  y += 22;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  for (const m of messages) {
    const header = `[${m.stage}] ${m.role}`;
    const block = `${header}\n${m.content}`;
    if (y > doc.internal.pageSize.getHeight() - 72) {
      doc.addPage();
      y = 56;
    }
    y = addWrappedText(doc, block, margin, y, maxW, 12) + 10;
  }

  const shortId = report.sessionId.replace(/-/g, "").slice(0, 8);
  doc.save(`interviewforge-report-${shortId}.pdf`);
}
