//
//  PublicProfileViewModel.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/6/26.
//

import Foundation

@Observable
@MainActor
final class PublicProfileViewModel {
    var profile: PublicProfile?
    var isLoading = false
    var error: String?

    private let api = APIService.shared

    func load(username: String) async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let encoded = username.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? username
            profile = try await api.request(path: "/users/\(encoded)", auth: false)
        } catch {
            self.error = error.localizedDescription
        }
    }

    var heatmapEntries: [HeatmapEntry] {
        guard let map = profile?.activityMap else { return [] }
        return map.map { HeatmapEntry(date: $0.key, count: $0.value) }.sorted { $0.date < $1.date }
    }
}
