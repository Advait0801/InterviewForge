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

    var assessmentId: String?

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
            let wrapped: ProblemDetailResponse = try await api.request(path: "/problems/\(id)", auth: true)
            problem = wrapped.problem
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
            let response: SubmitResponse = try await api.request(method: "POST", path: "/submissions", body: body, auth: true)
            submitResults = response
            await loadSubmissions()

            if let aid = assessmentId, let sid = response.submissionId {
                try await linkAssessmentSubmission(assessmentId: aid, problemId: problemId, submissionId: sid)
            }
        } catch {
            runError = error.localizedDescription
        }
    }

    private func linkAssessmentSubmission(assessmentId: String, problemId: String, submissionId: String) async throws {
        let body = LinkAssessmentSolveRequest(problemId: problemId, submissionId: submissionId)
        try await api.requestVoid(method: "POST", path: "/assessments/\(assessmentId)/solve", body: body, auth: true)
    }

    func loadSubmissions() async {
        guard let problemId = problem?.id else { return }
        isLoadingSubmissions = true
        defer { isLoadingSubmissions = false }
        do {
            let qi = [URLQueryItem(name: "problemId", value: problemId)]
            let list: SubmissionsListResponse = try await api.request(path: "/submissions", queryItems: qi, auth: true)
            submissions = list.submissions
        } catch { /* non-critical */ }
    }

    func requestReview(submissionId: String) async {
        isReviewing = true
        codeReview = nil
        reviewError = nil
        defer { isReviewing = false }
        do {
            let wrapped: CodeReviewResponse = try await api.request(method: "POST", path: "/submissions/\(submissionId)/review", auth: true)
            codeReview = wrapped.review
        } catch {
            reviewError = error.localizedDescription
        }
    }
}
