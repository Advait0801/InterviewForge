//
//  InterviewListView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import SwiftUI

struct InterviewListView: View {
    @State private var vm = InterviewViewModel()
    @State private var showNewInterview = false

    var body: some View {
        List {
            Section {
                Button {
                    showNewInterview = true
                } label: {
                    HStack {
                        Image(systemName: "plus.circle.fill")
                            .font(.title2)
                            .foregroundStyle(IFTheme.accentGradient)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("New Interview")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.primary)
                            Text("Practice with Amazon, Google, Meta or Apple")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }

            Section("Past Sessions") {
                if vm.isLoadingSessions && vm.sessions.isEmpty {
                    HStack { Spacer(); ProgressView(); Spacer() }
                } else if vm.sessions.isEmpty {
                    Text("No interview sessions yet")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(vm.sessions) { session in
                        NavigationLink(value: session.id) {
                            SessionRow(session: session)
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Interview")
        .navigationDestination(for: String.self) { id in
            InterviewChatView(sessionId: id)
        }
        .sheet(isPresented: $showNewInterview) {
            NewInterviewView()
        }
        .refreshable { await vm.loadSessions() }
        .task { await vm.loadSessions() }
    }
}

private struct SessionRow: View {
    let session: InterviewSession

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: IFTheme.companyIcon(session.company))
                .font(.title3)
                .foregroundStyle(IFTheme.companyColor(session.company))
                .frame(width: 36)

            VStack(alignment: .leading, spacing: 4) {
                Text(session.company.capitalized)
                    .font(.subheadline.weight(.medium))
                HStack(spacing: 6) {
                    if let stage = session.currentStage {
                        Text(stage.replacingOccurrences(of: "_", with: " ").capitalized)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Text("·")
                        .foregroundStyle(.secondary)
                    Text(session.status?.capitalized ?? "")
                        .font(.caption)
                        .foregroundStyle(session.status == "completed" ? .green : .orange)
                }
            }

            Spacer()

            if let date = session.createdAt?.prefix(10) {
                Text(date)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}
