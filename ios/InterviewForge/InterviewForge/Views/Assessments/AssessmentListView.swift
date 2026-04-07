//
//  AssessmentListView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/6/26.
//

import SwiftUI

struct AssessmentListView: View {
    @State private var vm = AssessmentListViewModel()
    @State private var showCreate = false
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            List {
                Section {
                    Button {
                        showCreate = true
                    } label: {
                        Label("Start new assessment", systemImage: "plus.circle.fill")
                            .font(.subheadline.weight(.semibold))
                    }
                }

                Section("Your assessments") {
                    if vm.isLoading && vm.assessments.isEmpty {
                        HStack { Spacer(); ProgressView(); Spacer() }
                    } else if vm.assessments.isEmpty {
                        Text("No assessments yet")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(vm.assessments) { a in
                            NavigationLink(value: a.id) {
                                AssessmentRow(assessment: a)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Assessments")
            .navigationDestination(for: String.self) { id in
                AssessmentDetailView(assessmentId: id)
            }
            .refreshable { await vm.load() }
            .sheet(isPresented: $showCreate) {
                CreateAssessmentSheet { newId in
                    showCreate = false
                    path.append(newId)
                }
            }
            .task { await vm.load() }
        }
    }
}

private struct AssessmentRow: View {
    let assessment: Assessment

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(assessment.status?.capitalized ?? "")
                    .font(.subheadline.weight(.medium))
                Text(metaLine)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if let score = assessment.score, assessment.status == "completed" {
                Text("\(Int(score))%")
                    .font(.headline.monospacedDigit())
                    .foregroundStyle(IFTheme.accent)
            }
        }
    }

    private var metaLine: String {
        let mins = assessment.timeLimitMinutes.map { "\($0) min" } ?? ""
        let cnt = assessment.problemCount.map { "\($0) problems" } ?? ""
        return [mins, cnt].filter { !$0.isEmpty }.joined(separator: " · ")
    }
}
