//
//  User.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation

struct MeResponse: Decodable, Sendable {
    let user: User
}

struct User: Codable, Identifiable, Sendable {
    let id: String
    let email: String?
    let username: String
    let name: String?
    let avatarUrl: String?
    let createdAt: String?
    let emailVerified: Bool?
}

/// Matches `GET /users/stats` response
struct UserStats: Decodable, Sendable {
    let problemsAttempted: Int?
    let problemsSolved: Int?
    let interviewsStarted: Int?
    let bestStreak: Int?
    let submissionsCount: Int?
    let acceptanceRate: Int?

    var displayStreak: Int { bestStreak ?? 0 }
}

struct ActivityData: Decodable, Sendable {
    let currentStreak: Int?
    let bestStreak: Int?
    let activityMap: [String: Int]?

    var heatmapEntries: [HeatmapEntry] {
        guard let map = activityMap else { return [] }
        return map.map { HeatmapEntry(date: $0.key, count: $0.value) }
            .sorted { $0.date < $1.date }
    }
}

struct HeatmapEntry: Decodable, Identifiable, Sendable {
    var id: String { date }
    let date: String
    let count: Int
}

/// Matches `GET /users/analytics`
struct UserAnalytics: Decodable, Sendable {
    let solvedOverTime: [SolvedOverTimePoint]?
    let difficultyDistribution: [String: Int]?
    let topicStrengths: [TopicStrengthPoint]?
    let acceptanceTrend: [AcceptanceTrendPoint]?
}

struct SolvedOverTimePoint: Decodable, Identifiable, Sendable {
    var id: String { day }
    let day: String
    let count: Int
}

struct TopicStrengthPoint: Decodable, Identifiable, Sendable {
    var id: String { topic }
    let topic: String
    let count: Int
}

struct AcceptanceTrendPoint: Decodable, Identifiable, Sendable {
    var id: String { week }
    let week: String
    let rate: Int
}

struct PublicProfile: Decodable, Sendable {
    let profile: PublicProfileInfo
    let stats: PublicProfileStats
    let recentActivity: [PublicActivityItem]
    let activityMap: [String: Int]?
}

struct PublicProfileInfo: Decodable, Sendable {
    let username: String
    let name: String?
    let avatarUrl: String?
    let createdAt: String?
}

struct PublicProfileStats: Decodable, Sendable {
    let problemsAttempted: Int?
    let problemsSolved: Int?
    let interviewsStarted: Int?
    let submissionsCount: Int?
    let acceptanceRate: Int?
}

struct PublicActivityItem: Decodable, Identifiable, Sendable {
    var id: String { "\(type)-\(title)-\(createdAt)" }
    let type: String
    let title: String
    let status: String?
    let createdAt: String
}

struct RecentActivity: Decodable, Identifiable, Sendable {
    var id: String { "\(type ?? "")-\(createdAt ?? "")" }
    let type: String?
    let title: String?
    let createdAt: String?
}
