//
//  LearningPathsViewModel.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation

@Observable
@MainActor
final class LearningPathsViewModel {
    var paths: [LearningPath] = []
    var isLoading = false
    var error: String?

    private let api = APIService.shared

    func load() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            paths = try await api.request(path: "/learning-paths", auth: true)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

@Observable
@MainActor
final class LearningPathDetailViewModel {
    var detail: LearningPathDetail?
    var isLoading = false
    var error: String?

    private let api = APIService.shared

    func load(slug: String) async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            detail = try await api.request(path: "/learning-paths/\(slug)", auth: true)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func markComplete(slug: String, problemId: String) async {
        do {
            try await api.requestVoid(method: "POST", path: "/learning-paths/\(slug)/complete/\(problemId)", auth: true)
            if let idx = detail?.problems?.firstIndex(where: { $0.id == problemId }) {
                await load(slug: slug)
                _ = idx // triggers refresh
            }
        } catch { /* toast error in production */ }
    }
}
