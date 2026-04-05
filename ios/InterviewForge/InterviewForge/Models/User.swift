//
//  User.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation

struct User: Codable, Identifiable, Sendable {
    let id: String
    let email: String?
    let username: String
    let name: String?
    let avatarUrl: String?
    let createdAt: String?
    let emailVerified: Bool?
}

struct UserStats: Decodable, Sendable {
    let totalAttempted: Int?
    let totalSolved: Int?
    let totalInterviews: Int?
    let currentStreak: Int?
    let acceptanceRate: Double?
}

struct ActivityData: Decodable, Sendable {
    let heatmap: [HeatmapEntry]?
    let currentStreak: Int?
    let bestStreak: Int?
}

struct HeatmapEntry: Decodable, Identifiable, Sendable {
    var id: String { date }
    let date: String
    let count: Int
}

struct UserAnalytics: Decodable, Sendable {
    let solvedOverTime: [SolvedEntry]?
    let difficultyDistribution: DifficultyDistribution?
    let topicCounts: [TopicCount]?
    let weeklyAcceptance: [WeeklyAcceptance]?
}

struct SolvedEntry: Decodable, Identifiable, Sendable {
    var id: String { date }
    let date: String
    let count: Int
}

struct DifficultyDistribution: Decodable, Sendable {
    let easy: Int?
    let medium: Int?
    let hard: Int?
}

struct TopicCount: Decodable, Identifiable, Sendable {
    var id: String { topic }
    let topic: String
    let count: Int
}

struct WeeklyAcceptance: Decodable, Identifiable, Sendable {
    var id: String { week }
    let week: String
    let rate: Double
}

struct PublicProfile: Decodable, Sendable {
    let username: String
    let name: String?
    let avatarUrl: String?
    let createdAt: String?
    let stats: UserStats?
    let recentActivity: [RecentActivity]?
    let heatmap: [HeatmapEntry]?
}

struct RecentActivity: Decodable, Identifiable, Sendable {
    var id: String { "\(type ?? "")-\(createdAt ?? "")" }
    let type: String?
    let title: String?
    let createdAt: String?
}
