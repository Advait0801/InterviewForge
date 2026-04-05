//
//  LearningPathDetailView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import SwiftUI

struct LearningPathDetailView: View {
    let slug: String
    @State private var vm = LearningPathDetailViewModel()

    var body: some View {
        Group {
            if vm.isLoading && vm.detail == nil {
                LoadingView()
            } else if let detail = vm.detail {
                pathContent(detail)
            } else if let error = vm.error {
                EmptyStateView(
                    icon: "exclamationmark.triangle",
                    title: "Error",
                    subtitle: error,
                    actionTitle: "Retry"
                ) { Task { await vm.load(slug: slug) } }
            }
        }
        .navigationTitle(vm.detail?.title ?? "Path")
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.load(slug: slug) }
    }

    private func pathContent(_ detail: LearningPathDetail) -> some View {
        List {
            if let desc = detail.description {
                Section {
                    Text(desc)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            Section("Problems") {
                ForEach(Array((detail.problems ?? []).enumerated()), id: \.element.id) { index, problem in
                    HStack(spacing: 12) {
                        // Order number
                        Text("\(index + 1)")
                            .font(.caption.weight(.bold).monospacedDigit())
                            .frame(width: 24, height: 24)
                            .background(IFTheme.accent.opacity(0.12))
                            .foregroundStyle(IFTheme.accent)
                            .clipShape(Circle())

                        // Completion indicator
                        Image(systemName: problem.isCompleted == true ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(problem.isCompleted == true ? .green : .secondary.opacity(0.4))

                        // Problem info
                        VStack(alignment: .leading, spacing: 2) {
                            Text(problem.title)
                                .font(.subheadline.weight(.medium))
                        }

                        Spacer()

                        if let diff = problem.difficulty {
                            DifficultyBadge(difficulty: diff)
                        }
                    }
                    .padding(.vertical, 4)
                    .swipeActions(edge: .trailing) {
                        if problem.isCompleted != true {
                            Button("Complete") {
                                Task { await vm.markComplete(slug: slug, problemId: problem.id) }
                            }
                            .tint(.green)
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await vm.load(slug: slug) }
    }
}
