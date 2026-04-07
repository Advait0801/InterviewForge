//
//  CreateAssessmentSheet.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/6/26.
//

import SwiftUI

struct CreateAssessmentSheet: View {
    @Environment(\.dismiss) private var dismiss
    var onCreated: (String) -> Void

    @State private var minutes = 60
    @State private var problemCount = 3
    @State private var mix = "mixed"
    @State private var isCreating = false
    @State private var error: String?

    private let mixes = ["mixed", "easy", "medium", "hard"]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Stepper("Time limit: \(minutes) min", value: $minutes, in: 15...180, step: 15)
                    Stepper("Problems: \(problemCount)", value: $problemCount, in: 1...10)
                    Picker("Difficulty mix", selection: $mix) {
                        ForEach(mixes, id: \.self) { m in
                            Text(m.capitalized).tag(m)
                        }
                    }
                }

                if let error {
                    Text(error).font(.caption).foregroundStyle(.red)
                }

                Section {
                    Button {
                        Task { await create() }
                    } label: {
                        if isCreating {
                            ProgressView()
                        } else {
                            Text("Create & start")
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .disabled(isCreating)
                }
            }
            .navigationTitle("New assessment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func create() async {
        isCreating = true
        error = nil
        defer { isCreating = false }
        do {
            let body = CreateAssessmentRequest(timeLimitMinutes: minutes, problemCount: problemCount, difficultyMix: mix)
            let res: CreateAssessmentResponse = try await APIService.shared.request(method: "POST", path: "/assessments", body: body, auth: true)
            dismiss()
            onCreated(res.assessmentId)
        } catch {
            self.error = error.localizedDescription
        }
    }
}
