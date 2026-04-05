//
//  Interview.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation

struct InterviewSession: Decodable, Identifiable, Sendable {
    let id: String
    let company: String
    let currentStage: String?
    let status: String?
    let createdAt: String?
}

struct InterviewDetail: Decodable, Sendable {
    let id: String
    let company: String
    let currentStage: String?
    let status: String?
    let messages: [InterviewMessage]?
    let createdAt: String?
}

struct InterviewMessage: Decodable, Identifiable, Sendable {
    let id: String
    let role: String
    let stage: String?
    let content: String
    let metadataJson: String?
}

struct StartInterviewRequest: Encodable {
    let company: String
    let difficulty: String?
}

struct AnswerRequest: Encodable {
    let answer: String
}

struct InterviewReport: Decodable, Sendable {
    let overallScore: Double?
    let stageScores: [StageScore]?
    let strengths: [String]?
    let weaknesses: [String]?
    let recommendations: [String]?
}

struct StageScore: Decodable, Identifiable, Sendable {
    var id: String { stage }
    let stage: String
    let score: Double?
}

struct TranscribeRequest: Encodable {
    let audioBase64: String
    let mimeType: String?
    let filename: String?
    let language: String?
}

struct TranscribeResponse: Decodable, Sendable {
    let transcript: String
}
