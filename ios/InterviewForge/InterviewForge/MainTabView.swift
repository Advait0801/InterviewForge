//
//  MainTabView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            Tab("Home", systemImage: "house.fill", value: 0) {
                NavigationStack {
                    DashboardView()
                }
            }

            Tab("Practice", systemImage: "chevron.left.forwardslash.chevron.right", value: 1) {
                NavigationStack {
                    ProblemsListView()
                }
            }

            Tab("Interview", systemImage: "mic.fill", value: 2) {
                NavigationStack {
                    InterviewPlaceholderView()
                }
            }

            Tab("OA", systemImage: "clock.fill", value: 3) {
                NavigationStack {
                    AssessmentPlaceholderView()
                }
            }

            Tab("More", systemImage: "ellipsis", value: 4) {
                NavigationStack {
                    MoreView()
                }
            }
        }
    }
}

// MARK: - Placeholder views for Day 4-5 features

private struct InterviewPlaceholderView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "mic.fill")
                .font(.system(size: 48))
                .foregroundStyle(IFTheme.accentGradient)
            Text("AI Interviews")
                .font(.title2.bold())
            Text("Coming soon — practice mock interviews\nwith Amazon, Google, Meta & Apple")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .navigationTitle("Interview")
    }
}

private struct AssessmentPlaceholderView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "clock.fill")
                .font(.system(size: 48))
                .foregroundStyle(IFTheme.accentGradient)
            Text("Timed Assessments")
                .font(.title2.bold())
            Text("Coming soon — simulate online\ncoding assessments with a timer")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .navigationTitle("Assessments")
    }
}
