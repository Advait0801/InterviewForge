//
//  Problem.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation

struct ProblemsListResponse: Decodable, Sendable {
    let problems: [Problem]
}

struct ProblemDetailResponse: Decodable, Sendable {
    let problem: Problem
}

struct Problem: Decodable, Identifiable, Sendable {
    let id: String
    let slug: String?
    let title: String
    let description: String?
    let difficulty: String
    let topics: [String]?
    let companies: [String]?
    let hints: [String]?
    let editorial: String?
    let testCases: [TestCase]?
    let starterCode: [String: String]?
    let isSolved: Bool?
    let isBookmarked: Bool?
}

struct TestCase: Decodable, Sendable {
    let input: String?
    let expectedOutput: String?
}
