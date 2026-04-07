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
                    InterviewListView()
                }
            }

            Tab("OA", systemImage: "clock.fill", value: 3) {
                AssessmentListView()
            }

            Tab("More", systemImage: "ellipsis", value: 4) {
                NavigationStack {
                    MoreView()
                }
            }
        }
    }
}
