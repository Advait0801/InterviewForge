//
//  DashboardView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import SwiftUI

struct DashboardView: View {
    @Environment(AuthManager.self) private var auth
    @State private var vm = DashboardViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                greeting
                statsGrid
                activitySection
                recommendedSection
            }
            .padding()
        }
        .navigationTitle("Dashboard")
        .refreshable { await vm.load() }
        .overlay {
            if vm.isLoading && vm.stats == nil {
                LoadingView()
            }
        }
        .task { await vm.load() }
    }

    // MARK: - Greeting

    private var greeting: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Welcome back,")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(auth.currentUser?.name ?? auth.currentUser?.username ?? "User")
                .font(.title.bold())
        }
    }

    // MARK: - Stats grid

    private var statsGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            StatCard(
                title: "Solved",
                value: "\(vm.stats?.totalSolved ?? 0)",
                icon: "checkmark.circle.fill",
                iconColor: .green
            )
            StatCard(
                title: "Interviews",
                value: "\(vm.stats?.totalInterviews ?? 0)",
                icon: "mic.fill",
                iconColor: .purple
            )
            StatCard(
                title: "Streak",
                value: "\(vm.activity?.currentStreak ?? vm.stats?.currentStreak ?? 0) days",
                icon: "flame.fill",
                iconColor: .orange
            )
            StatCard(
                title: "Acceptance",
                value: formatPercent(vm.stats?.acceptanceRate),
                icon: "chart.line.uptrend.xyaxis",
                iconColor: .blue
            )
        }
    }

    // MARK: - Activity heatmap

    @ViewBuilder
    private var activitySection: some View {
        if let heatmap = vm.activity?.heatmap, !heatmap.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Activity")
                        .font(.headline)
                    Spacer()
                    if let best = vm.activity?.bestStreak {
                        Text("Best: \(best) days")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                ActivityHeatmapView(entries: heatmap)
            }
            .padding()
            .background(IFTheme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: IFTheme.cardCornerRadius))
        }
    }

    // MARK: - Recommendations

    @ViewBuilder
    private var recommendedSection: some View {
        if let recs = vm.recommendations {
            VStack(alignment: .leading, spacing: 12) {
                Text("Recommended")
                    .font(.headline)

                if let topics = recs.recommendedTopics, !topics.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(topics, id: \.self) { topic in
                                Text(topic)
                                    .font(.caption.weight(.medium))
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(IFTheme.accent.opacity(0.12))
                                    .foregroundStyle(IFTheme.accent)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                }

                if let problems = recs.recommended, !problems.isEmpty {
                    ForEach(problems.prefix(5)) { problem in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(problem.title)
                                    .font(.subheadline.weight(.medium))
                                if let topics = problem.topics, !topics.isEmpty {
                                    Text(topics.prefix(3).joined(separator: ", "))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            DifficultyBadge(difficulty: problem.difficulty)
                        }
                        .padding(.vertical, 4)
                    }
                }

                if let reasoning = recs.reasoning {
                    Text(reasoning)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.top, 4)
                }
            }
            .padding()
            .background(IFTheme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: IFTheme.cardCornerRadius))
        }
    }

    private func formatPercent(_ value: Double?) -> String {
        guard let value else { return "–" }
        return "\(Int(value * 100))%"
    }
}
