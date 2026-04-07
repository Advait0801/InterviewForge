//
//  AnalyticsViewModel.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/6/26.
//

import Foundation

@Observable
@MainActor
final class AnalyticsViewModel {
    var analytics: UserAnalytics?
    var isLoading = false
    var error: String?

    private let api = APIService.shared

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            analytics = try await api.request(path: "/users/analytics", auth: true)
        } catch {
            self.error = error.localizedDescription
        }
    }
}
