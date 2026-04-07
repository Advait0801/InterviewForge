//
//  Leaderboard.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation

struct LeaderboardAPIResponse: Decodable, Sendable {
    let leaderboard: [LeaderboardEntry]
    let total: Int?
    let page: Int?
    let limit: Int?
}

struct LeaderboardEntry: Decodable, Identifiable, Sendable {
    var id: String { "\(rank)-\(username)" }
    let rank: Int
    let username: String
    let name: String?
    let avatarUrl: String?
    let solved: Int
    let acceptanceRate: Int?
}
