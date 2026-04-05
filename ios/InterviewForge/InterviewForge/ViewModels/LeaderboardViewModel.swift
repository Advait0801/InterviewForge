//
//  LeaderboardViewModel.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation

@Observable
@MainActor
final class LeaderboardViewModel {
    var entries: [LeaderboardEntry] = []
    var isLoading = false
    var error: String?
    var page = 1
    let limit = 25

    private let api = APIService.shared

    func load(reset: Bool = false) async {
        guard !isLoading else { return }
        if reset { page = 1 }
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let queryItems = [
                URLQueryItem(name: "page", value: "\(page)"),
                URLQueryItem(name: "limit", value: "\(limit)")
            ]
            let response: LeaderboardResponse = try await api.request(
                path: "/leaderboard",
                queryItems: queryItems
            )
            if reset {
                entries = response.entries ?? []
            } else {
                entries.append(contentsOf: response.entries ?? [])
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadMore() async {
        page += 1
        await load()
    }
}
