//
//  AssessmentDetailView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/6/26.
//

import SwiftUI

struct AssessmentDetailView: View {
    let assessmentId: String
    @State private var vm = AssessmentDetailViewModel()

    var body: some View {
        Group {
            if vm.isLoading && vm.detail == nil {
                LoadingView()
            } else if let detail = vm.detail {
                assessmentBody(detail)
            } else if let error = vm.error {
                EmptyStateView(
                    icon: "exclamationmark.triangle",
                    title: "Error",
                    subtitle: error,
                    actionTitle: "Retry"
                ) {
                    Task { await vm.load(assessmentId: assessmentId) }
                }
            }
        }
        .navigationTitle("Timed OA")
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear { vm.stopTimer() }
        .task {
            await vm.load(assessmentId: assessmentId)
        }
    }

    private func assessmentBody(_ detail: AssessmentDetailResponse) -> some View {
        let active = detail.assessment.status == "active"
        return VStack(spacing: 0) {
            if active {
                HStack {
                    Image(systemName: "timer")
                        .foregroundStyle(remainingColor)
                    Text(vm.formattedTime)
                        .font(.title2.monospacedDigit().bold())
                        .foregroundStyle(remainingColor)
                    Spacer()
                }
                .padding()
                .background(IFTheme.cardBackground)
            }

            if let res = vm.submitResult {
                VStack(spacing: 8) {
                    Text("Score: \(Int(res.score ?? 0))%")
                        .font(.title2.bold())
                    Text("\(res.passed ?? 0) / \(res.total ?? 0) problems passed")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding()
            }

            if detail.assessment.status == "completed", vm.submitResult == nil {
                Text("Final score: \(Int(detail.assessment.score ?? 0))%")
                    .font(.headline)
                    .padding()
            }

            TabView(selection: $vm.selectedProblemIndex) {
                ForEach(Array(detail.problems.enumerated()), id: \.element.id) { idx, p in
                    ProblemDetailView(problemId: p.problemId)
                        .tag(idx)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .automatic))

            if active {
                Button {
                    Task { await vm.submitAssessment(assessmentId: assessmentId) }
                } label: {
                    if vm.isSubmittingOA {
                        ProgressView()
                    } else {
                        Text("Submit assessment")
                            .fontWeight(.semibold)
                    }
                }
                .buttonStyle(.borderedProminent)
                .padding()
                .disabled(vm.isSubmittingOA)
            }
        }
    }

    private var remainingColor: Color {
        vm.remainingMs < 60_000 ? .red : .primary
    }
}
