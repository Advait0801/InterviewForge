//
//  ProblemsDetailView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import SwiftUI

struct ProblemDetailView: View {
    let problemId: String

    @State private var problem: Problem?
    @State private var isLoading = true
    @State private var error: String?
    @State private var showHintIndex: Int = 0
    @State private var showEditorial = false

    var body: some View {
        Group {
            if isLoading {
                LoadingView()
            } else if let problem {
                problemContent(problem)
            } else if let error {
                EmptyStateView(
                    icon: "exclamationmark.triangle",
                    title: "Error",
                    subtitle: error,
                    actionTitle: "Retry"
                ) { Task { await load() } }
            }
        }
        .navigationTitle(problem?.title ?? "Problem")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func problemContent(_ problem: Problem) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                HStack {
                    DifficultyBadge(difficulty: problem.difficulty)
                    if let topics = problem.topics, !topics.isEmpty {
                        Text(topics.joined(separator: " · "))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                // Description
                if let desc = problem.description {
                    Text(desc)
                        .font(.body)
                }

                // Test cases preview
                if let cases = problem.testCases, !cases.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Examples")
                            .font(.headline)

                        ForEach(Array(cases.prefix(3).enumerated()), id: \.offset) { idx, tc in
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Example \(idx + 1)")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                if let input = tc.input {
                                    codeBlock("Input: \(input)")
                                }
                                if let output = tc.expectedOutput {
                                    codeBlock("Output: \(output)")
                                }
                            }
                        }
                    }
                }

                // Hints
                if let hints = problem.hints, !hints.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Hints")
                            .font(.headline)

                        ForEach(0..<min(showHintIndex, hints.count), id: \.self) { i in
                            HStack(alignment: .top, spacing: 8) {
                                Image(systemName: "lightbulb.fill")
                                    .foregroundStyle(.yellow)
                                    .font(.caption)
                                Text(hints[i])
                                    .font(.subheadline)
                            }
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.yellow.opacity(0.08))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }

                        if showHintIndex < hints.count {
                            Button {
                                withAnimation { showHintIndex += 1 }
                            } label: {
                                Label("Reveal Hint \(showHintIndex + 1)", systemImage: "eye")
                                    .font(.subheadline.weight(.medium))
                            }
                        }
                    }
                }

                // Editorial
                if let editorial = problem.editorial, !editorial.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Button {
                            withAnimation { showEditorial.toggle() }
                        } label: {
                            HStack {
                                Text("Editorial")
                                    .font(.headline)
                                    .foregroundStyle(.primary)
                                Spacer()
                                Image(systemName: showEditorial ? "chevron.up" : "chevron.down")
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .buttonStyle(.plain)

                        if showEditorial {
                            Text(editorial)
                                .font(.subheadline)
                                .padding()
                                .background(IFTheme.cardBackground)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                    }
                }

                // Code editor placeholder — full implementation in Day 3
                VStack(spacing: 12) {
                    Image(systemName: "chevron.left.forwardslash.chevron.right")
                        .font(.system(size: 32))
                        .foregroundStyle(.secondary)
                    Text("Code editor available in full workspace")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 40)
                .background(IFTheme.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: IFTheme.cardCornerRadius))
            }
            .padding()
        }
    }

    private func codeBlock(_ text: String) -> some View {
        Text(text)
            .font(.system(.caption, design: .monospaced))
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.tertiarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            problem = try await APIService.shared.request(path: "/problems/\(problemId)", auth: true)
        } catch {
            self.error = error.localizedDescription
        }
    }
}
