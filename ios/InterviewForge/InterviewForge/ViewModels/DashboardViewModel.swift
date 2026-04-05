//
//  DashboardViewModel.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation

@Observable
@MainActor
final class DashboardViewModel {
    var stats: UserStats?
    var activity: ActivityData?
    var recommendations: Recommendations?
    var isLoading = false
    var error: String?

    private let api = APIService.shared

    func load() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }

        async let statsTask: UserStats = api.request(path: "/users/stats", auth: true)
        async let activityTask: ActivityData = api.request(path: "/users/activity", auth: true)
        async let recsTask: Recommendations = api.request(path: "/recommendations", auth: true)

        do {
            stats = try await statsTask
        } catch {
            self.error = error.localizedDescription
        }

        do {
            activity = try await activityTask
        } catch { /* non-critical */ }

        do {
            recommendations = try await recsTask
        } catch { /* non-critical */ }
    }
}
