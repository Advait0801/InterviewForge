//
//  Interview.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation

struct InterviewSessionsListResponse: Decodable, Sendable {
    let sessions: [InterviewSession]
}

struct InterviewSession: Decodable, Identifiable, Sendable {
    let id: String
    let company: String
    let currentStage: String?
    let status: String?
    let createdAt: String?
}

struct InterviewGetResponse: Decodable, Sendable {
    let session: InterviewSession
    let messages: [InterviewMessage]
}

struct CreateInterviewResponse: Decodable, Sendable {
    let session: InterviewSession
}

struct InterviewMessage: Decodable, Identifiable, Sendable {
    let id: String
    let role: String
    let stage: String?
    let content: String
}

struct StartInterviewRequest: Encodable {
    let company: String
    let difficulty: String?
}

struct AnswerRequest: Encodable {
    let answer: String
}

struct InterviewReport: Decodable, Sendable {
    let sessionId: String?
    let company: String?
    let overallScore: Double?
    let stageScores: [String: StageScoreValue]?
    let strengths: [String]?
    let weaknesses: [String]?
    let recommendations: [String]?
}

struct StageScoreValue: Decodable, Sendable {
    let score: Double?

    init(from decoder: Decoder) throws {
        if let c = try? decoder.singleValueContainer() {
            if let d = try? c.decode(Double.self) {
                score = d
                return
            }
            if let i = try? c.decode(Int.self) {
                score = Double(i)
                return
            }
            if let s = try? c.decode(String.self), let d = Double(s) {
                score = d
                return
            }
        }
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let d = try c.decodeIfPresent(Double.self, forKey: .score) {
            score = d
        } else if let s = try c.decodeIfPresent(String.self, forKey: .score), let d = Double(s) {
            score = d
        } else if let i = try c.decodeIfPresent(Int.self, forKey: .score) {
            score = Double(i)
        } else {
            score = nil
        }
    }

    private enum CodingKeys: String, CodingKey {
        case score
    }
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
