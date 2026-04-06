//
//  NewInterviewView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import SwiftUI

struct NewInterviewView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var vm = InterviewViewModel()
    @State private var selectedCompany = "amazon"
    @State private var selectedDifficulty = "medium"
    @State private var navigateToChat = false

    private let companies = ["amazon", "google", "meta", "apple"]
    private let difficulties = ["easy", "medium", "hard"]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 28) {
                    // Company picker
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Company")
                            .font(.headline)

                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                            ForEach(companies, id: \.self) { company in
                                companyCard(company)
                            }
                        }
                    }

                    // Difficulty picker
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Difficulty")
                            .font(.headline)

                        HStack(spacing: 10) {
                            ForEach(difficulties, id: \.self) { diff in
                                let isSelected = selectedDifficulty == diff
                                Button {
                                    selectedDifficulty = diff
                                } label: {
                                    Text(diff.capitalized)
                                        .font(.subheadline.weight(.semibold))
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 12)
                                        .background(isSelected ? IFTheme.difficultyColor(diff) : Color(.tertiarySystemFill))
                                        .foregroundStyle(isSelected ? .white : .primary)
                                        .clipShape(RoundedRectangle(cornerRadius: 12))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    // Info
                    VStack(alignment: .leading, spacing: 8) {
                        Label("4-stage interview", systemImage: "list.number")
                        Label("Behavioral → Coding → System Design → Core CS", systemImage: "arrow.right")
                        Label("AI evaluates each answer with follow-ups", systemImage: "sparkles")
                        Label("Voice recording supported", systemImage: "mic.fill")
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(IFTheme.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                    // Start button
                    Button {
                        Task { await startInterview() }
                    } label: {
                        Group {
                            if vm.isLoadingSession {
                                ProgressView().tint(.white)
                            } else {
                                Label("Start Interview", systemImage: "play.fill")
                                    .fontWeight(.semibold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                    }
                    .buttonStyle(.borderedProminent)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .disabled(vm.isLoadingSession)

                    if let error = vm.error {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }
                .padding()
            }
            .navigationTitle("New Interview")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .navigationDestination(isPresented: $navigateToChat) {
                if let id = vm.activeSession?.id {
                    InterviewChatView(sessionId: id, preloadedVM: vm)
                }
            }
        }
    }

    private func companyCard(_ company: String) -> some View {
        let isSelected = selectedCompany == company
        return Button {
            selectedCompany = company
        } label: {
            VStack(spacing: 8) {
                Image(systemName: IFTheme.companyIcon(company))
                    .font(.title2)
                    .foregroundStyle(isSelected ? .white : IFTheme.companyColor(company))
                Text(company.capitalized)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(isSelected ? .white : .primary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 18)
            .background(isSelected ? IFTheme.companyColor(company) : IFTheme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(isSelected ? Color.clear : Color(.separator), lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
    }

    private func startInterview() async {
        await vm.startSession(company: selectedCompany, difficulty: selectedDifficulty)
        if vm.activeSession != nil {
            navigateToChat = true
        }
    }
}
