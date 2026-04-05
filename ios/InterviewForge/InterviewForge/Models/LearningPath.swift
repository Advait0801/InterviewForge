//
//  LearningPath.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation

struct LearningPath: Decodable, Identifiable, Sendable {
    var id: String { slug }
    let slug: String
    let title: String
    let description: String?
    let problemCount: Int?
    let completedCount: Int?
}

struct LearningPathDetail: Decodable, Sendable {
    let slug: String
    let title: String
    let description: String?
    let problems: [PathProblem]?
}

struct PathProblem: Decodable, Identifiable, Sendable {
    let id: String
    let title: String
    let difficulty: String?
    let isCompleted: Bool?
}

struct Recommendations: Decodable, Sendable {
    let recommendedTopics: [String]?
    let recommended: [Problem]?
    let revisit: [Problem]?
    let reasoning: String?
    let focusAreas: [String]?
}
