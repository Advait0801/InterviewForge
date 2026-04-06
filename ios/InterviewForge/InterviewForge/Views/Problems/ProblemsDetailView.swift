//
//  ProblemsDetailView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import SwiftUI

struct ProblemDetailView: View {
    let problemId: String

    @Environment(\.colorScheme) private var colorScheme
    @State private var vm = ProblemWorkspaceViewModel()
    @State private var activeTab: WorkspaceTab = .description
    @State private var showHintIndex = 0
    @State private var showEditorial = false

    enum WorkspaceTab: String, CaseIterable {
        case description = "Description"
        case code = "Code"
        case results = "Results"
        case submissions = "History"
    }

    var body: some View {
        Group {
            if vm.isLoading {
                LoadingView()
            } else if let problem = vm.problem {
                workspace(problem)
            } else if let error = vm.error {
                EmptyStateView(
                    icon: "exclamationmark.triangle",
                    title: "Error",
                    subtitle: error,
                    actionTitle: "Retry"
                ) { Task { await vm.loadProblem(id: problemId) } }
            }
        }
        .navigationTitle(vm.problem?.title ?? "Problem")
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.loadProblem(id: problemId) }
    }

    // MARK: - Workspace

    private func workspace(_ problem: Problem) -> some View {
        VStack(spacing: 0) {
            // Tab bar
            tabBar

            // Content
            TabView(selection: $activeTab) {
                descriptionTab(problem)
                    .tag(WorkspaceTab.description)
                codeTab
                    .tag(WorkspaceTab.code)
                resultsTab
                    .tag(WorkspaceTab.results)
                submissionsTab
                    .tag(WorkspaceTab.submissions)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            // Bottom action bar
            actionBar
        }
    }

    // MARK: - Tab bar

    private var tabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 0) {
                ForEach(WorkspaceTab.allCases, id: \.self) { tab in
                    Button {
                        withAnimation(.snappy(duration: 0.2)) { activeTab = tab }
                    } label: {
                        Text(tab.rawValue)
                            .font(.subheadline.weight(activeTab == tab ? .semibold : .regular))
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                            .foregroundStyle(activeTab == tab ? IFTheme.accent : .secondary)
                    }
                    .overlay(alignment: .bottom) {
                        if activeTab == tab {
                            Rectangle()
                                .fill(IFTheme.accent)
                                .frame(height: 2)
                        }
                    }
                }
            }
        }
        .background(Color(.systemBackground))
        .overlay(alignment: .bottom) {
            Divider()
        }
    }

    // MARK: - Description tab

    private func descriptionTab(_ problem: Problem) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    DifficultyBadge(difficulty: problem.difficulty)
                    if let topics = problem.topics, !topics.isEmpty {
                        Text(topics.joined(separator: " · "))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                if let desc = problem.description {
                    Text(desc)
                        .font(.body)
                }

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

                if let editorial = problem.editorial, !editorial.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Button {
                            withAnimation { showEditorial.toggle() }
                        } label: {
                            HStack {
                                Text("Editorial").font(.headline).foregroundStyle(.primary)
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
            }
            .padding()
        }
    }

    // MARK: - Code tab

    private var codeTab: some View {
        VStack(spacing: 0) {
            // Language picker
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(vm.languages, id: \.self) { lang in
                        let isSelected = vm.selectedLanguage == lang
                        Button {
                            vm.switchLanguage(lang)
                        } label: {
                            Text(langDisplayName(lang))
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(isSelected ? IFTheme.accent : Color(.tertiarySystemFill))
                                .foregroundStyle(isSelected ? .white : .primary)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
            }
            .background(Color(.secondarySystemBackground))

            CodeEditorView(
                code: $vm.code,
                language: vm.selectedLanguage,
                theme: colorScheme == .dark ? "dark" : "light"
            )
        }
    }

    // MARK: - Results tab

    private var resultsTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if vm.isRunning || vm.isSubmitting {
                    LoadingView(message: vm.isRunning ? "Running..." : "Submitting...")
                } else if let error = vm.runError {
                    EmptyStateView(icon: "exclamationmark.triangle", title: "Error", subtitle: error)
                } else if let results = vm.submitResults ?? vm.runResults {
                    resultContent(results, isSubmission: vm.submitResults != nil)
                } else {
                    EmptyStateView(
                        icon: "play.circle",
                        title: "No results yet",
                        subtitle: "Run or submit your code to see results"
                    )
                }
            }
            .padding()
        }
    }

    private func resultContent(_ response: SubmitResponse, isSubmission: Bool) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            // Status banner
            HStack {
                let passed = response.status?.lowercased() == "accepted"
                Image(systemName: passed ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .foregroundStyle(passed ? .green : .red)
                Text(response.status ?? "Unknown")
                    .font(.headline)
                    .foregroundStyle(passed ? .green : .red)
                Spacer()
                if let runtime = response.runtimeMs {
                    Text("\(runtime)ms")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
            .background(IFTheme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 12))

            // Per-test results
            if let tests = response.results, !tests.isEmpty {
                ForEach(Array(tests.enumerated()), id: \.offset) { idx, test in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Test \(idx + 1)")
                                .font(.subheadline.weight(.semibold))
                            Spacer()
                            Image(systemName: test.passed == true ? "checkmark.circle.fill" : "xmark.circle.fill")
                                .foregroundStyle(test.passed == true ? .green : .red)
                        }
                        if let input = test.input {
                            codeBlock("Input: \(input)")
                        }
                        if let expected = test.expectedOutput {
                            codeBlock("Expected: \(expected)")
                        }
                        if let actual = test.actualOutput, test.passed != true {
                            codeBlock("Got: \(actual)")
                        }
                        if let stdout = test.stdout, !stdout.isEmpty {
                            codeBlock("stdout: \(stdout)")
                        }
                    }
                    .padding()
                    .background(IFTheme.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }

            // AI Review button after successful submission
            if isSubmission, let submissionId = response.id {
                Divider()
                aiReviewSection(submissionId: submissionId)
            }
        }
    }

    // MARK: - AI Code Review

    private func aiReviewSection(submissionId: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if vm.isReviewing {
                HStack {
                    ProgressView()
                    Text("Analyzing your code...")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            } else if let review = vm.codeReview {
                VStack(alignment: .leading, spacing: 14) {
                    Text("AI Code Review")
                        .font(.headline)

                    if let score = review.qualityScore {
                        HStack {
                            Text("Quality Score")
                                .font(.subheadline)
                            Spacer()
                            Text("\(score)/10")
                                .font(.title3.bold())
                                .foregroundStyle(score >= 7 ? .green : score >= 4 ? .orange : .red)
                        }
                    }

                    reviewField("Time Complexity", review.timeComplexity)
                    reviewField("Space Complexity", review.spaceComplexity)
                    reviewList("Strengths", review.strengths, icon: "checkmark.circle", color: .green)
                    reviewList("Issues", review.issues, icon: "exclamationmark.triangle", color: .orange)
                    reviewList("Optimizations", review.optimizations, icon: "bolt", color: .blue)

                    if let summary = review.summary {
                        Text(summary)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .padding(.top, 4)
                    }
                }
                .padding()
                .background(IFTheme.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            } else {
                Button {
                    Task { await vm.requestReview(submissionId: submissionId) }
                } label: {
                    Label("Get AI Code Review", systemImage: "sparkles")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.bordered)
                .tint(IFTheme.accent)

                if let err = vm.reviewError {
                    Text(err).font(.caption).foregroundStyle(.red)
                }
            }
        }
    }

    @ViewBuilder
    private func reviewField(_ label: String, _ value: String?) -> some View {
        if let value {
            HStack {
                Text(label).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                Spacer()
                Text(value).font(.caption.weight(.medium).monospaced())
            }
        }
    }

    @ViewBuilder
    private func reviewList(_ title: String, _ items: [String]?, icon: String, color: Color) -> some View {
        if let items, !items.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text(title).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                ForEach(items, id: \.self) { item in
                    HStack(alignment: .top, spacing: 6) {
                        Image(systemName: icon).font(.caption2).foregroundStyle(color)
                        Text(item).font(.caption)
                    }
                }
            }
        }
    }

    // MARK: - Submissions tab

    private var submissionsTab: some View {
        ScrollView {
            VStack(spacing: 12) {
                if vm.isLoadingSubmissions && vm.submissions.isEmpty {
                    LoadingView(message: "Loading history...")
                } else if vm.submissions.isEmpty {
                    EmptyStateView(
                        icon: "clock",
                        title: "No submissions yet",
                        subtitle: "Submit your solution to see it here"
                    )
                } else {
                    ForEach(vm.submissions) { sub in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 8) {
                                    statusPill(sub.status)
                                    Text(sub.language.uppercased())
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(.secondary)
                                }
                                if let ts = sub.createdAt {
                                    Text(ts.prefix(10))
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 4) {
                                if let rt = sub.runtimeMs {
                                    Text("\(rt)ms")
                                        .font(.caption.monospacedDigit())
                                }
                                if let mem = sub.memoryKb {
                                    Text("\(mem)KB")
                                        .font(.caption2.monospacedDigit())
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        .padding()
                        .background(IFTheme.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                }
            }
            .padding()
        }
        .task { await vm.loadSubmissions() }
    }

    private func statusPill(_ status: String) -> some View {
        let accepted = status.lowercased() == "accepted"
        return Text(status)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .foregroundStyle(accepted ? .green : .red)
            .background((accepted ? Color.green : Color.red).opacity(0.12))
            .clipShape(Capsule())
    }

    // MARK: - Action bar

    private var actionBar: some View {
        HStack(spacing: 12) {
            Button {
                activeTab = .results
                Task { await vm.run() }
            } label: {
                Label(vm.isRunning ? "Running..." : "Run", systemImage: "play.fill")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.bordered)
            .disabled(vm.code.isEmpty || vm.isRunning || vm.isSubmitting)

            Button {
                activeTab = .results
                Task { await vm.submit() }
            } label: {
                Label(vm.isSubmitting ? "Submitting..." : "Submit", systemImage: "paperplane.fill")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .disabled(vm.code.isEmpty || vm.isRunning || vm.isSubmitting)
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
    }

    // MARK: - Helpers

    private func codeBlock(_ text: String) -> some View {
        Text(text)
            .font(.system(.caption, design: .monospaced))
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.tertiarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func langDisplayName(_ lang: String) -> String {
        switch lang {
        case "python": "Python"
        case "c": "C"
        case "cpp": "C++"
        case "java": "Java"
        default: lang
        }
    }
}
