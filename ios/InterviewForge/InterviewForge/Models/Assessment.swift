//
//  Assessment.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation

struct Assessment: Decodable, Identifiable, Sendable {
    let id: String
    let timeLimitMinutes: Int?
    let problemCount: Int?
    let status: String?
    let score: Int?
    let startedAt: String?
    let finishedAt: String?
    let createdAt: String?
    let remainingMs: Int?
    let problems: [AssessmentProblem]?
}

struct AssessmentProblem: Decodable, Identifiable, Sendable {
    let id: String
    let title: String?
    let difficulty: String?
    let problemOrder: Int?
    let submissionId: String?
}

struct CreateAssessmentRequest: Encodable {
    let timeLimitMinutes: Int
    let problemCount: Int
    let difficultyMix: String?
}
