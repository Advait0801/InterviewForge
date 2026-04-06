//
//  ProblemWorkspaceViewModel.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation

@Observable
@MainActor
final class ProblemWorkspaceViewModel {
    var problem: Problem?
    var code = ""
    var selectedLanguage = "python"
    var isLoading = true
    var error: String?

    // Run/Submit
    var isRunning = false
    var isSubmitting = false
    var runResults: SubmitResponse?
    var submitResults: SubmitResponse?
    var runError: String?

    // Submissions
    var submissions: [Submission] = []
    var isLoadingSubmissions = false

    // Code Review
    var codeReview: CodeReview?
    var isReviewing = false
    var reviewError: String?

    let languages = ["python", "c", "cpp", "java"]

    private let api = APIService.shared

    func loadProblem(id: String) async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            problem = try await api.request(path: "/problems/\(id)", auth: true)
            if let starterCode = problem?.starterCode, let starter = starterCode[selectedLanguage] {
                code = starter
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func switchLanguage(_ lang: String) {
        selectedLanguage = lang
        if let starterCode = problem?.starterCode, let starter = starterCode[lang] {
            code = starter
        }
        runResults = nil
        submitResults = nil
    }

    func run() async {
        guard let problemId = problem?.id else { return }
        isRunning = true
        runError = nil
        runResults = nil
        defer { isRunning = false }
        do {
            let body = SubmitRequest(problemId: problemId, language: selectedLanguage, code: code, mode: "run")
            runResults = try await api.request(method: "POST", path: "/submissions", body: body, auth: true)
        } catch {
            runError = error.localizedDescription
        }
    }

    func submit() async {
        guard let problemId = problem?.id else { return }
        isSubmitting = true
        runError = nil
        submitResults = nil
        defer { isSubmitting = false }
        do {
            let body = SubmitRequest(problemId: problemId, language: selectedLanguage, code: code, mode: "submit")
            submitResults = try await api.request(method: "POST", path: "/submissions", body: body, auth: true)
            await loadSubmissions()
        } catch {
            runError = error.localizedDescription
        }
    }

    func loadSubmissions() async {
        guard let problemId = problem?.id else { return }
        isLoadingSubmissions = true
        defer { isLoadingSubmissions = false }
        do {
            let qi = [URLQueryItem(name: "problemId", value: problemId)]
            submissions = try await api.request(path: "/submissions", queryItems: qi, auth: true)
        } catch { /* non-critical */ }
    }

    func requestReview(submissionId: String) async {
        isReviewing = true
        codeReview = nil
        reviewError = nil
        defer { isReviewing = false }
        do {
            codeReview = try await api.request(method: "POST", path: "/submissions/\(submissionId)/review", auth: true)
        } catch {
            reviewError = error.localizedDescription
        }
    }
}
