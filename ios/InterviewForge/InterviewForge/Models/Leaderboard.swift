//
//  Leaderboard.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation

struct LeaderboardResponse: Decodable, Sendable {
    let entries: [LeaderboardEntry]?

    init(from decoder: Decoder) throws {
        if let container = try? decoder.container(keyedBy: CodingKeys.self) {
            entries = try container.decodeIfPresent([LeaderboardEntry].self, forKey: .entries)
        } else {
            let array = try decoder.singleValueContainer().decode([LeaderboardEntry].self)
            entries = array
        }
    }

    private enum CodingKeys: String, CodingKey {
        case entries
    }
}

struct LeaderboardEntry: Decodable, Identifiable, Sendable {
    var id: String { "\(rank ?? 0)-\(username)" }
    let rank: Int?
    let username: String
    let name: String?
    let avatarUrl: String?
    let problemsSolved: Int?
    let acceptanceRate: Double?
}
