//
//  AnalyticsView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/6/26.
//

import SwiftUI
import Charts

struct AnalyticsView: View {
    @State private var vm = AnalyticsViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if vm.isLoading && vm.analytics == nil {
                    VStack(spacing: 12) {
                        SkeletonView().frame(height: 120)
                        SkeletonView().frame(height: 200)
                    }
                    .padding()
                } else if let a = vm.analytics {
                    solvedChart(a)
                    difficultyChart(a)
                    topicsChart(a)
                    acceptanceChart(a)
                } else if let err = vm.error {
                    EmptyStateView(
                        icon: "chart.bar.xaxis",
                        title: "Couldn't load analytics",
                        subtitle: err,
                        actionTitle: "Retry"
                    ) { Task { await vm.load() } }
                }
            }
            .padding()
        }
        .navigationTitle("Analytics")
        .refreshable { await vm.load() }
        .task { await vm.load() }
    }

    private func solvedChart(_ a: UserAnalytics) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Solved (90 days)")
                .font(.headline)
            if let series = a.solvedOverTime, !series.isEmpty {
                Chart(series) { pt in
                    BarMark(
                        x: .value("Day", pt.day),
                        y: .value("Count", pt.count)
                    )
                    .foregroundStyle(IFTheme.accentGradient)
                }
                .frame(height: 200)
            } else {
                Text("No data yet").foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(IFTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: IFTheme.cardCornerRadius))
    }

    private func difficultyChart(_ a: UserAnalytics) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("By difficulty")
                .font(.headline)
            if let dist = a.difficultyDistribution, !dist.isEmpty {
                Chart(Array(dist.keys.sorted()), id: \.self) { key in
                    SectorMark(
                        angle: .value("Count", dist[key] ?? 0),
                        innerRadius: .ratio(0.5),
                        angularInset: 1.5
                    )
                    .foregroundStyle(by: .value("Level", key))
                }
                .frame(height: 220)
            } else {
                Text("No data yet").foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(IFTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: IFTheme.cardCornerRadius))
    }

    private func topicsChart(_ a: UserAnalytics) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Top topics")
                .font(.headline)
            if let topics = a.topicStrengths, !topics.isEmpty {
                Chart(topics) { t in
                    BarMark(
                        x: .value("Count", t.count),
                        y: .value("Topic", t.topic)
                    )
                    .foregroundStyle(IFTheme.accent)
                }
                .frame(height: CGFloat(min(topics.count, 8)) * 36)
            } else {
                Text("No data yet").foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(IFTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: IFTheme.cardCornerRadius))
    }

    private func acceptanceChart(_ a: UserAnalytics) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Weekly acceptance %")
                .font(.headline)
            if let trend = a.acceptanceTrend, !trend.isEmpty {
                Chart(trend) { pt in
                    LineMark(
                        x: .value("Week", pt.week),
                        y: .value("Rate", pt.rate)
                    )
                    .interpolationMethod(.catmullRom)
                    AreaMark(
                        x: .value("Week", pt.week),
                        y: .value("Rate", pt.rate)
                    )
                    .foregroundStyle(IFTheme.accent.opacity(0.2))
                }
                .frame(height: 180)
            } else {
                Text("No data yet").foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(IFTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: IFTheme.cardCornerRadius))
    }
}
