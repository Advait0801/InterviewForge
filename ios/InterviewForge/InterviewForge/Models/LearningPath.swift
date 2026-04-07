//
//  LearningPath.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation

struct LearningPathsListResponse: Decodable, Sendable {
    let paths: [LearningPath]
}

struct LearningPath: Decodable, Identifiable, Sendable {
    var id: String { slug }
    let slug: String
    let title: String
    let description: String?
    let topic: String?
    let difficultyLevel: String?
    let problemCount: Int?
    let completedCount: Int?
}

struct PathDetailAPIResponse: Decodable, Sendable {
    let path: PathDetailMeta
    let problems: [PathProblemItem]
}

struct PathDetailMeta: Decodable, Sendable {
    let slug: String
    let title: String
    let description: String?
    let topic: String?
    let difficultyLevel: String?
    let problemCount: Int?
    let completedCount: Int?
}

struct PathProblemItem: Decodable, Identifiable, Sendable {
    var id: String { problemId }
    let problemId: String
    let position: Int?
    let title: String
    let slug: String?
    let difficulty: String?
    let isCompleted: Bool?
}

struct Recommendations: Decodable, Sendable {
    let recommended: [Problem]?
    let revisit: [Problem]?
    let reasoning: String?
    let focusAreas: [String]?
    let difficultySuggestion: String?
}
