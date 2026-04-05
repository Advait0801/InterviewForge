//
//  LearningPathsView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import SwiftUI

struct LearningPathsView: View {
    @State private var vm = LearningPathsViewModel()

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 14) {
                ForEach(vm.paths) { path in
                    NavigationLink(value: path.slug) {
                        PathCard(path: path)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding()
        }
        .navigationTitle("Learning Paths")
        .navigationDestination(for: String.self) { slug in
            LearningPathDetailView(slug: slug)
        }
        .refreshable { await vm.load() }
        .overlay {
            if vm.isLoading && vm.paths.isEmpty {
                LoadingView()
            } else if let error = vm.error, vm.paths.isEmpty {
                EmptyStateView(
                    icon: "exclamationmark.triangle",
                    title: "Couldn't load paths",
                    subtitle: error,
                    actionTitle: "Retry"
                ) { Task { await vm.load() } }
            }
        }
        .task { await vm.load() }
    }
}

private struct PathCard: View {
    let path: LearningPath

    private var progress: Double {
        guard let total = path.problemCount, total > 0 else { return 0 }
        return Double(path.completedCount ?? 0) / Double(total)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "map.fill")
                    .foregroundStyle(IFTheme.accentGradient)
                Text(path.title)
                    .font(.headline)
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundStyle(.secondary)
                    .font(.caption)
            }

            if let desc = path.description {
                Text(desc)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            HStack(spacing: 12) {
                ProgressView(value: progress)
                    .tint(IFTheme.accent)

                Text("\(path.completedCount ?? 0)/\(path.problemCount ?? 0)")
                    .font(.caption.weight(.medium).monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(IFTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: IFTheme.cardCornerRadius))
    }
}
