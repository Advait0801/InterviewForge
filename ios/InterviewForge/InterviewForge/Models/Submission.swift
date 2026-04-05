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
    let language: String
    let code: String?
    let status: String
    let runtimeMs: Int?
    let memoryKb: Int?
    let createdAt: String?
}

struct SubmitRequest: Encodable {
    let problemId: String
    let language: String
    let code: String
    let mode: String
}

struct SubmitResponse: Decodable, Sendable {
    let id: String?
    let status: String?
    let results: [TestResult]?
    let runtimeMs: Int?
    let memoryKb: Int?
}

struct TestResult: Decodable, Identifiable, Sendable {
    var id: String { "\(testCase ?? 0)" }
    let testCase: Int?
    let passed: Bool?
    let input: String?
    let expectedOutput: String?
    let actualOutput: String?
    let stdout: String?
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
