//
//  Assessment.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation

struct AssessmentsListResponse: Decodable, Sendable {
    let assessments: [Assessment]
}

struct Assessment: Decodable, Identifiable, Sendable {
    let id: String
    let timeLimitMinutes: Int?
    let problemCount: Int?
    let difficultyMix: String?
    let status: String?
    let score: Double?
    let startedAt: String?
    let finishedAt: String?
    let createdAt: String?
}

struct CreateAssessmentRequest: Encodable {
    let timeLimitMinutes: Int
    let problemCount: Int
    let difficultyMix: String?
}

struct CreateAssessmentResponse: Decodable, Sendable {
    let assessmentId: String
    let problemCount: Int
    let timeLimitMinutes: Int
}

struct AssessmentDetailResponse: Decodable, Sendable {
    let assessment: Assessment
    let problems: [AssessmentProblemRow]
    let remainingMs: Int
}

struct AssessmentProblemRow: Decodable, Identifiable, Sendable {
    let id: String
    let problemId: String
    let title: String?
    let slug: String?
    let difficulty: String?
    let problemOrder: Int?
    let submissionId: String?
    let submissionStatus: String?
}

struct LinkAssessmentSolveRequest: Encodable {
    let problemId: String
    let submissionId: String
}

struct LinkAssessmentSolveResponse: Decodable, Sendable {
    let ok: Bool?
}

struct SubmitAssessmentResponse: Decodable, Sendable {
    let score: Double?
    let passed: Int?
    let total: Int?
    let status: String?
}
