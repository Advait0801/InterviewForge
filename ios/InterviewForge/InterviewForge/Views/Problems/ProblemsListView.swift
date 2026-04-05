//
//  ProblemsListView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import SwiftUI

struct ProblemsListView: View {
    @State private var vm = ProblemsViewModel()

    var body: some View {
        List {
            filterSection
            problemsSection
        }
        .listStyle(.plain)
        .searchable(text: $vm.searchText, prompt: "Search problems...")
        .navigationTitle("Practice")
        .refreshable { await vm.load() }
        .overlay {
            if vm.isLoading && vm.problems.isEmpty {
                LoadingView(message: "Loading problems...")
            } else if !vm.isLoading && vm.filteredProblems.isEmpty && !vm.problems.isEmpty {
                EmptyStateView(
                    icon: "magnifyingglass",
                    title: "No matches",
                    subtitle: "Try a different filter or search term"
                )
            } else if let error = vm.error, vm.problems.isEmpty {
                EmptyStateView(
                    icon: "exclamationmark.triangle",
                    title: "Couldn't load problems",
                    subtitle: error,
                    actionTitle: "Retry"
                ) { Task { await vm.load() } }
            }
        }
        .task { await vm.load() }
    }

    // MARK: - Filters

    private var filterSection: some View {
        Section {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    difficultyChip(nil, label: "All")
                    difficultyChip("easy", label: "Easy")
                    difficultyChip("medium", label: "Medium")
                    difficultyChip("hard", label: "Hard")

                    Divider().frame(height: 24)

                    solvedChip(nil, label: "All")
                    solvedChip("solved", label: "Solved")
                    solvedChip("unsolved", label: "Unsolved")
                }
                .padding(.vertical, 4)
            }
        }
        .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
    }

    private func difficultyChip(_ value: String?, label: String) -> some View {
        let isSelected = vm.selectedDifficulty == value
        return Button {
            withAnimation(.snappy) { vm.selectedDifficulty = value }
        } label: {
            Text(label)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(isSelected ? IFTheme.accent : Color(.tertiarySystemFill))
                .foregroundStyle(isSelected ? .white : .primary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private func solvedChip(_ value: String?, label: String) -> some View {
        let isSelected = vm.showSolvedFilter == value
        return Button {
            withAnimation(.snappy) {
                vm.showSolvedFilter = value
                Task { await vm.load() }
            }
        } label: {
            Text(label)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(isSelected ? IFTheme.accent : Color(.tertiarySystemFill))
                .foregroundStyle(isSelected ? .white : .primary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Problem rows

    private var problemsSection: some View {
        Section {
            ForEach(vm.filteredProblems) { problem in
                NavigationLink(value: problem.id) {
                    ProblemRow(problem: problem, isBookmarked: vm.bookmarkedIds.contains(problem.id)) {
                        Task { await vm.toggleBookmark(problemId: problem.id) }
                    }
                }
            }
        }
        .navigationDestination(for: String.self) { id in
            ProblemDetailView(problemId: id)
        }
    }
}

// MARK: - Problem row

private struct ProblemRow: View {
    let problem: Problem
    let isBookmarked: Bool
    let onBookmarkTap: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            if problem.isSolved == true {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                    .font(.subheadline)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(problem.title)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)

                if let topics = problem.topics, !topics.isEmpty {
                    Text(topics.prefix(3).joined(separator: " · "))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            DifficultyBadge(difficulty: problem.difficulty)

            Button {
                onBookmarkTap()
            } label: {
                Image(systemName: isBookmarked ? "bookmark.fill" : "bookmark")
                    .foregroundStyle(isBookmarked ? IFTheme.accent : .secondary)
                    .font(.subheadline)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 2)
    }
}
