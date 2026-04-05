//
//  LeaderboardView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import SwiftUI

struct LeaderboardView: View {
    @State private var vm = LeaderboardViewModel()

    var body: some View {
        List {
            ForEach(Array(vm.entries.enumerated()), id: \.element.id) { index, entry in
                LeaderboardRow(entry: entry, index: index)
                    .onAppear {
                        if index == vm.entries.count - 3 {
                            Task { await vm.loadMore() }
                        }
                    }
            }

            if vm.isLoading {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
                .listRowSeparator(.hidden)
            }
        }
        .listStyle(.plain)
        .navigationTitle("Leaderboard")
        .refreshable { await vm.load(reset: true) }
        .overlay {
            if !vm.isLoading && vm.entries.isEmpty {
                if let error = vm.error {
                    EmptyStateView(
                        icon: "exclamationmark.triangle",
                        title: "Couldn't load leaderboard",
                        subtitle: error,
                        actionTitle: "Retry"
                    ) { Task { await vm.load(reset: true) } }
                } else {
                    EmptyStateView(
                        icon: "trophy",
                        title: "No entries yet",
                        subtitle: "Be the first to solve problems!"
                    )
                }
            }
        }
        .task { await vm.load(reset: true) }
    }
}

private struct LeaderboardRow: View {
    let entry: LeaderboardEntry
    let index: Int

    private var rankDisplay: Int { entry.rank ?? (index + 1) }

    var body: some View {
        HStack(spacing: 14) {
            // Rank
            Group {
                switch rankDisplay {
                case 1: Text("🥇").font(.title2)
                case 2: Text("🥈").font(.title2)
                case 3: Text("🥉").font(.title2)
                default:
                    Text("#\(rankDisplay)")
                        .font(.subheadline.weight(.bold).monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 36)

            // Avatar
            AsyncImage(url: avatarURL) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Image(systemName: "person.circle.fill")
                    .resizable()
                    .foregroundStyle(.secondary.opacity(0.4))
            }
            .frame(width: 36, height: 36)
            .clipShape(Circle())

            // Name
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.username)
                    .font(.subheadline.weight(.medium))
                if let name = entry.name, !name.isEmpty {
                    Text(name)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            // Solved count
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(entry.problemsSolved ?? 0)")
                    .font(.subheadline.bold().monospacedDigit())
                Text("solved")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    private var avatarURL: URL? {
        guard let urlString = entry.avatarUrl else { return nil }
        return URL(string: urlString)
    }
}
