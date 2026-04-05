//
//  MoreView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import SwiftUI

struct MoreView: View {
    @Environment(AuthManager.self) private var auth

    var body: some View {
        List {
            Section("Explore") {
                NavigationLink {
                    LeaderboardView()
                } label: {
                    Label("Leaderboard", systemImage: "trophy.fill")
                }

                NavigationLink {
                    LearningPathsView()
                } label: {
                    Label("Learning Paths", systemImage: "map.fill")
                }

                NavigationLink {
                    AnalyticsPlaceholderView()
                } label: {
                    Label("Analytics", systemImage: "chart.bar.fill")
                }
            }

            Section("Account") {
                NavigationLink {
                    SettingsView()
                } label: {
                    Label("Settings", systemImage: "gearshape.fill")
                }

                if let user = auth.currentUser {
                    NavigationLink {
                        ProfilePlaceholderView(username: user.username)
                    } label: {
                        Label("Public Profile", systemImage: "person.crop.circle")
                    }
                }
            }

            Section {
                Button(role: .destructive) {
                    auth.logout()
                } label: {
                    Label("Log Out", systemImage: "rectangle.portrait.and.arrow.right")
                        .foregroundStyle(.red)
                }
            }
        }
        .navigationTitle("More")
    }
}

// MARK: - Placeholder views for Day 5 features

private struct AnalyticsPlaceholderView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "chart.bar.fill")
                .font(.system(size: 48))
                .foregroundStyle(IFTheme.accentGradient)
            Text("Analytics")
                .font(.title2.bold())
            Text("Charts and insights coming soon")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .navigationTitle("Analytics")
    }
}

private struct ProfilePlaceholderView: View {
    let username: String

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "person.crop.circle")
                .font(.system(size: 48))
                .foregroundStyle(IFTheme.accentGradient)
            Text("@\(username)")
                .font(.title2.bold())
            Text("Public profile view coming soon")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .navigationTitle("Profile")
    }
}
