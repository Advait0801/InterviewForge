//
//  AssessmentViewModel.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/6/26.
//

import Foundation

@Observable
@MainActor
final class AssessmentListViewModel {
    var assessments: [Assessment] = []
    var isLoading = false
    var error: String?

    private let api = APIService.shared

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let res: AssessmentsListResponse = try await api.request(path: "/assessments", auth: true)
            assessments = res.assessments
        } catch {
            self.error = error.localizedDescription
        }
    }
}

@Observable
@MainActor
final class AssessmentDetailViewModel {
    var detail: AssessmentDetailResponse?
    var remainingMs: Int = 0
    var isLoading = false
    var error: String?
    var selectedProblemIndex = 0
    var isSubmittingOA = false
    var submitResult: SubmitAssessmentResponse?

    private let api = APIService.shared
    private var timerTask: Task<Void, Never>?

    func load(assessmentId: String) async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let res: AssessmentDetailResponse = try await api.request(path: "/assessments/\(assessmentId)", auth: true)
            detail = res
            remainingMs = res.remainingMs
            startTimerIfNeeded()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func startTimerIfNeeded() {
        timerTask?.cancel()
        guard detail?.assessment.status == "active" else { return }
        timerTask = Task {
            while !Task.isCancelled, remainingMs > 0 {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                if Task.isCancelled { break }
                remainingMs = max(0, remainingMs - 1000)
            }
        }
    }

    func stopTimer() {
        timerTask?.cancel()
        timerTask = nil
    }

    func submitAssessment(assessmentId: String) async {
        isSubmittingOA = true
        submitResult = nil
        defer { isSubmittingOA = false }
        do {
            let res: SubmitAssessmentResponse = try await api.request(method: "POST", path: "/assessments/\(assessmentId)/submit", auth: true)
            submitResult = res
            stopTimer()
            await load(assessmentId: assessmentId)
        } catch {
            self.error = error.localizedDescription
        }
    }

    var formattedTime: String {
        let s = remainingMs / 1000
        let m = s / 60
        let sec = s % 60
        return String(format: "%d:%02d", m, sec)
    }
}
