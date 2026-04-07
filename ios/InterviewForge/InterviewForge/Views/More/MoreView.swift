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
                    SystemDesignView()
                } label: {
                    Label("System Design", systemImage: "square.split.2x2")
                }

                NavigationLink {
                    AnalyticsView()
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
                        PublicProfileView(username: user.username)
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
