//
//  PublicProfileView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/6/26.
//

import SwiftUI

struct PublicProfileView: View {
    let username: String
    @State private var vm = PublicProfileViewModel()

    var body: some View {
        Group {
            if vm.isLoading && vm.profile == nil {
                LoadingView()
            } else if let p = vm.profile {
                ScrollView {
                    VStack(spacing: 20) {
                        header(p)
                        stats(p.stats)
                        if !vm.heatmapEntries.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Activity")
                                    .font(.headline)
                                ActivityHeatmapView(entries: vm.heatmapEntries)
                            }
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(IFTheme.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: IFTheme.cardCornerRadius))
                        }
                        activityList(p.recentActivity)
                    }
                    .padding()
                }
            } else if let err = vm.error {
                EmptyStateView(icon: "person.crop.circle.badge.xmark", title: "Profile", subtitle: err, actionTitle: "Retry") {
                    Task { await vm.load(username: username) }
                }
            }
        }
        .navigationTitle("@\(username)")
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.load(username: username) }
    }

    private func header(_ p: PublicProfile) -> some View {
        VStack(spacing: 12) {
            AvatarImageView(urlString: p.profile.avatarUrl, size: 88)

            Text(p.profile.name ?? p.profile.username)
                .font(.title2.bold())
            Text("@\(p.profile.username)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private func stats(_ s: PublicProfileStats) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            StatCard(title: "Solved", value: "\(s.problemsSolved ?? 0)", icon: "checkmark.circle.fill", iconColor: .green)
            StatCard(title: "Attempted", value: "\(s.problemsAttempted ?? 0)", icon: "target", iconColor: .orange)
            StatCard(title: "Interviews", value: "\(s.interviewsStarted ?? 0)", icon: "mic.fill", iconColor: .purple)
            StatCard(title: "Acceptance", value: "\(s.acceptanceRate ?? 0)%", icon: "percent", iconColor: .blue)
        }
    }

    private func activityList(_ items: [PublicActivityItem]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent activity")
                .font(.headline)
            ForEach(items) { item in
                HStack {
                    Image(systemName: item.type == "interview" ? "mic.fill" : "chevron.left.forwardslash.chevron.right")
                        .foregroundStyle(.secondary)
                    VStack(alignment: .leading) {
                        Text(item.title).font(.subheadline)
                        Text(item.createdAt.prefix(16))
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if let st = item.status {
                        Text(st)
                            .font(.caption2)
                            .foregroundStyle(st == "passed" ? .green : .secondary)
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(IFTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: IFTheme.cardCornerRadius))
    }
}
