//
//  InterviewReportView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import SwiftUI

struct InterviewReportView: View {
    @Bindable var vm: InterviewViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoadingReport && vm.report == nil {
                    LoadingView(message: "Generating report...")
                } else if let report = vm.report {
                    reportContent(report)
                } else {
                    VStack(spacing: 16) {
                        Image(systemName: "doc.text")
                            .font(.system(size: 48))
                            .foregroundStyle(.secondary)
                        Text("Report not available")
                            .font(.headline)
                        Button("Generate Report") {
                            Task { await vm.loadReport() }
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }
            .navigationTitle("Interview Report")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
                if vm.report != nil {
                    ToolbarItem(placement: .topBarTrailing) {
                        ShareLink(item: reportText) {
                            Image(systemName: "square.and.arrow.up")
                        }
                    }
                }
            }
            .task {
                if vm.report == nil {
                    await vm.loadReport()
                }
            }
        }
    }

    private func reportContent(_ report: InterviewReport) -> some View {
        ScrollView {
            VStack(spacing: 24) {
                // Overall score ring
                VStack(spacing: 8) {
                    ZStack {
                        Circle()
                            .stroke(Color(.systemGray5), lineWidth: 10)
                            .frame(width: 100, height: 100)
                        Circle()
                            .trim(from: 0, to: (report.overallScore ?? 0) / 10.0)
                            .stroke(scoreColor(report.overallScore ?? 0), style: StrokeStyle(lineWidth: 10, lineCap: .round))
                            .frame(width: 100, height: 100)
                            .rotationEffect(.degrees(-90))
                        Text(String(format: "%.1f", report.overallScore ?? 0))
                            .font(.title.bold().monospacedDigit())
                    }
                    Text("Overall Score")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 8)

                // Stage scores
                if let stages = report.stageScores, !stages.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Stage Scores")
                            .font(.headline)

                        ForEach(stages) { stage in
                            HStack {
                                Text(vm.stageDisplayName(stage.stage))
                                    .font(.subheadline)
                                Spacer()
                                ProgressView(value: (stage.score ?? 0) / 10.0)
                                    .frame(width: 100)
                                    .tint(scoreColor(stage.score ?? 0))
                                Text(String(format: "%.1f", stage.score ?? 0))
                                    .font(.subheadline.bold().monospacedDigit())
                                    .frame(width: 32, alignment: .trailing)
                            }
                        }
                    }
                    .padding()
                    .background(IFTheme.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: IFTheme.cardCornerRadius))
                }

                // Strengths
                if let strengths = report.strengths, !strengths.isEmpty {
                    feedbackSection(title: "Strengths", items: strengths, icon: "checkmark.circle.fill", color: .green)
                }

                // Weaknesses
                if let weaknesses = report.weaknesses, !weaknesses.isEmpty {
                    feedbackSection(title: "Areas for Improvement", items: weaknesses, icon: "exclamationmark.triangle.fill", color: .orange)
                }

                // Recommendations
                if let recs = report.recommendations, !recs.isEmpty {
                    feedbackSection(title: "Recommendations", items: recs, icon: "lightbulb.fill", color: .blue)
                }
            }
            .padding()
        }
    }

    private func feedbackSection(title: String, items: [String], icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.headline)

            ForEach(items, id: \.self) { item in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: icon)
                        .foregroundStyle(color)
                        .font(.caption)
                        .padding(.top, 2)
                    Text(item)
                        .font(.subheadline)
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(IFTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: IFTheme.cardCornerRadius))
    }

    private func scoreColor(_ score: Double) -> Color {
        if score >= 7 { return .green }
        if score >= 4 { return .orange }
        return .red
    }

    private var reportText: String {
        guard let report = vm.report else { return "" }
        var text = "InterviewForge Report — \(vm.activeSession?.company.capitalized ?? "")\n\n"
        text += "Overall Score: \(String(format: "%.1f", report.overallScore ?? 0))/10\n\n"

        if let stages = report.stageScores {
            text += "Stage Scores:\n"
            for s in stages {
                text += "  \(vm.stageDisplayName(s.stage)): \(String(format: "%.1f", s.score ?? 0))/10\n"
            }
            text += "\n"
        }

        if let strengths = report.strengths {
            text += "Strengths:\n" + strengths.map { "  • \($0)" }.joined(separator: "\n") + "\n\n"
        }
        if let weaknesses = report.weaknesses {
            text += "Areas for Improvement:\n" + weaknesses.map { "  • \($0)" }.joined(separator: "\n") + "\n\n"
        }
        if let recs = report.recommendations {
            text += "Recommendations:\n" + recs.map { "  • \($0)" }.joined(separator: "\n") + "\n"
        }
        return text
    }
}
