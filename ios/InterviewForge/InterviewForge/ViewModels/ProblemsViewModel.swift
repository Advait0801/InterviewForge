//
//  ProblemsViewModel.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation

@Observable
@MainActor
final class ProblemsViewModel {
    var problems: [Problem] = []
    var bookmarkedIds: Set<String> = []
    var isLoading = false
    var error: String?

    var searchText = ""
    var selectedDifficulty: String? = nil
    var showSolvedFilter: String? = nil  // nil = all, "solved", "unsolved"

    private let api = APIService.shared

    var filteredProblems: [Problem] {
        problems.filter { problem in
            if !searchText.isEmpty {
                let match = problem.title.localizedCaseInsensitiveContains(searchText)
                    || (problem.topics ?? []).contains { $0.localizedCaseInsensitiveContains(searchText) }
                if !match { return false }
            }
            if let diff = selectedDifficulty, diff != problem.difficulty.lowercased() {
                return false
            }
            return true
        }
    }

    func load() async {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            var queryItems: [URLQueryItem] = []
            if let solved = showSolvedFilter {
                queryItems.append(.init(name: "solved", value: solved))
            }
            problems = try await api.request(path: "/problems", queryItems: queryItems.isEmpty ? nil : queryItems, auth: true)
        } catch {
            self.error = error.localizedDescription
        }

        do {
            let ids: [BookmarkEntry] = try await api.request(path: "/problem-bookmarks", auth: true)
            bookmarkedIds = Set(ids.map(\.problemId))
        } catch { /* non-critical */ }
    }

    func toggleBookmark(problemId: String) async {
        let isBookmarked = bookmarkedIds.contains(problemId)
        if isBookmarked {
            bookmarkedIds.remove(problemId)
        } else {
            bookmarkedIds.insert(problemId)
        }
        do {
            if isBookmarked {
                try await api.requestVoid(method: "DELETE", path: "/problem-bookmarks/\(problemId)", auth: true)
            } else {
                try await api.requestVoid(method: "POST", path: "/problem-bookmarks/\(problemId)", auth: true)
            }
        } catch {
            // Revert on failure
            if isBookmarked {
                bookmarkedIds.insert(problemId)
            } else {
                bookmarkedIds.remove(problemId)
            }
        }
    }
}

private struct BookmarkEntry: Decodable {
    let problemId: String
}
