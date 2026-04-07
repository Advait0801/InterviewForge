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
                ) {
                    Task { await vm.load(slug: slug) }
                }
            }
        }
        .navigationTitle(vm.detail?.path.title ?? "Path")
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.load(slug: slug) }
    }

    private func pathContent(_ detail: PathDetailAPIResponse) -> some View {
        List {
            if let desc = detail.path.description {
                Section {
                    Text(desc)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            Section("Problems") {
                ForEach(detail.problems) { item in
                    NavigationLink(value: item.problemId) {
                        HStack(spacing: 12) {
                            Text("\((item.position ?? 0) + 1)")
                                .font(.caption.weight(.bold).monospacedDigit())
                                .frame(width: 24, height: 24)
                                .background(IFTheme.accent.opacity(0.12))
                                .foregroundStyle(IFTheme.accent)
                                .clipShape(Circle())

                            Image(systemName: item.isCompleted == true ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(item.isCompleted == true ? .green : .secondary.opacity(0.4))

                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.title)
                                    .font(.subheadline.weight(.medium))
                            }

                            Spacer()

                            if let diff = item.difficulty {
                                DifficultyBadge(difficulty: diff)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                    .swipeActions(edge: .trailing) {
                        if item.isCompleted != true {
                            Button("Complete") {
                                Task { await vm.markComplete(slug: slug, problemId: item.problemId) }
                            }
                            .tint(.green)
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationDestination(for: String.self) { problemId in
            ProblemDetailView(problemId: problemId)
        }
        .refreshable { await vm.load(slug: slug) }
    }
}

