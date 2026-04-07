//
//  SystemDesignViewModel.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/6/26.
//

import Foundation

@Observable
@MainActor
final class SystemDesignViewModel {
    var prompt = ""
    var explanation = ""
    var company: String?
    var result: SystemDesignResult?
    var isAnalyzing = false
    var error: String?

    private let api = APIService.shared

    let presetPrompts = [
        "Design a URL shortener like bit.ly",
        "Design Twitter / X",
        "Design a distributed cache",
        "Design a rate limiter",
        "Design a real-time chat system"
    ]

    func analyze() async {
        guard !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !explanation.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            error = "Enter a prompt and your explanation."
            return
        }
        isAnalyzing = true
        error = nil
        result = nil
        defer { isAnalyzing = false }
        do {
            let body = SystemDesignRequest(prompt: prompt, explanation: explanation, company: company)
            result = try await api.request(method: "POST", path: "/interviews/system-design/analyze", body: body, auth: true)
        } catch {
            self.error = error.localizedDescription
        }
    }
}
