//
//  InterviewViewModel.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation

@Observable
@MainActor
final class InterviewViewModel {
    // List
    var sessions: [InterviewSession] = []
    var isLoadingSessions = false

    // Active session
    var activeSession: InterviewDetail?
    var messages: [InterviewMessage] = []
    var isLoadingSession = false

    // Interaction
    var isAnswering = false
    var isTranscribing = false
    var transcription: String?

    // Report
    var report: InterviewReport?
    var isLoadingReport = false

    var error: String?

    let stages = ["behavioral", "coding", "system_design", "core_cs"]

    private let api = APIService.shared

    // MARK: - Session list

    func loadSessions() async {
        isLoadingSessions = true
        defer { isLoadingSessions = false }
        do {
            sessions = try await api.request(path: "/interviews", auth: true)
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Start session

    func startSession(company: String, difficulty: String?) async {
        isLoadingSession = true
        error = nil
        defer { isLoadingSession = false }
        do {
            let body = StartInterviewRequest(company: company, difficulty: difficulty)
            let detail: InterviewDetail = try await api.request(method: "POST", path: "/interviews", body: body, auth: true)
            activeSession = detail
            messages = detail.messages ?? []
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Load session

    func loadSession(id: String) async {
        isLoadingSession = true
        error = nil
        defer { isLoadingSession = false }
        do {
            let detail: InterviewDetail = try await api.request(path: "/interviews/\(id)", auth: true)
            activeSession = detail
            messages = detail.messages ?? []
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Submit answer

    func submitAnswer(text: String) async {
        guard let sessionId = activeSession?.id else { return }
        isAnswering = true
        defer { isAnswering = false }
        do {
            let body = AnswerRequest(answer: text)
            let updated: InterviewDetail = try await api.request(
                method: "POST",
                path: "/interviews/\(sessionId)/answer",
                body: body,
                auth: true
            )
            activeSession = updated
            messages = updated.messages ?? []
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Transcribe audio

    func transcribeAudio(base64: String) async -> String? {
        isTranscribing = true
        transcription = nil
        defer { isTranscribing = false }
        do {
            let body = TranscribeRequest(audioBase64: base64, mimeType: "audio/m4a", filename: "recording.m4a", language: nil)
            let response: TranscribeResponse = try await api.request(
                method: "POST",
                path: "/interviews/speech/transcribe",
                body: body,
                auth: true
            )
            transcription = response.transcript
            return response.transcript
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    // MARK: - Report

    func loadReport() async {
        guard let sessionId = activeSession?.id else { return }
        isLoadingReport = true
        defer { isLoadingReport = false }
        do {
            report = try await api.request(path: "/interviews/\(sessionId)/report", auth: true)
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Helpers

    var currentStage: String {
        activeSession?.currentStage ?? "behavioral"
    }

    var isCompleted: Bool {
        activeSession?.status?.lowercased() == "completed"
    }

    func stageDisplayName(_ stage: String) -> String {
        switch stage.lowercased() {
        case "behavioral": "Behavioral"
        case "coding": "Coding"
        case "system_design": "System Design"
        case "core_cs": "Core CS"
        default: stage.capitalized
        }
    }

    func stageIndex(_ stage: String) -> Int {
        stages.firstIndex(of: stage.lowercased()) ?? 0
    }
}
