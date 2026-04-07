//
//  Submission.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation

struct Submission: Decodable, Identifiable, Sendable {
    let id: String
    let problemId: String?
    let problemTitle: String?
    let language: String
    let code: String?
    let status: String
    let runtimeMs: Int?
    let memoryKb: Int?
    let createdAt: String?
}

struct SubmissionsListResponse: Decodable, Sendable {
    let submissions: [Submission]
}

struct SubmitRequest: Encodable {
    let problemId: String
    let language: String
    let code: String
    let mode: String
}

/// Matches Express `/submissions` POST — run vs submit shapes differ slightly.
struct SubmitResponse: Decodable, Sendable {
    let mode: String?
    let submissionId: String?
    let status: String?
    let passed: Bool?
    let results: [TestResult]?
    let runtimeMs: Int?
    let memoryKb: Int?

    /// Unified pass flag for UI
    var isSuccess: Bool {
        if let status {
            return status.lowercased() == "passed" || status.lowercased() == "accepted"
        }
        return passed == true
    }

    var submissionIdForReview: String? { submissionId }
}

struct TestResult: Decodable, Identifiable, Sendable {
    var id: String { "\(testCase ?? index ?? 0)" }
    let testCase: Int?
    let index: Int?
    let passed: Bool?
    let input: String?
    let expectedOutput: String?
    let actualOutput: String?
    let stdout: String?
    let error: String?
}

struct CodeReviewResponse: Decodable, Sendable {
    let review: CodeReview
}

struct CodeReview: Decodable, Sendable {
    let timeComplexity: String?
    let spaceComplexity: String?
    let qualityScore: Int?
    let strengths: [String]?
    let issues: [String]?
    let optimizations: [String]?
    let summary: String?
}
