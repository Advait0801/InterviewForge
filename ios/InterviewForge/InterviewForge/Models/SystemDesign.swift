//
//  SystemDesign.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation

struct SystemDesignRequest: Encodable {
    let prompt: String
    let explanation: String
    let company: String?
}

struct SystemDesignResult: Decodable, Sendable {
    let summary: String?
    let nodes: [DiagramNode]?
    let edges: [DiagramEdge]?
    let risks: [String]?
    let improvements: [String]?
    let rubric: [String: RubricScore]?
}

struct DiagramNode: Decodable, Identifiable, Sendable {
    let id: String
    let label: String
    let type: String?
}

struct DiagramEdge: Decodable, Identifiable, Sendable {
    var id: String { "\(source)-\(target)" }
    let source: String
    let target: String
    let label: String?
}

struct RubricScore: Decodable, Sendable {
    let score: Double?
    /// AI returns `notes`; we map either field into this.
    let feedback: String?

    enum CodingKeys: String, CodingKey {
        case score
        case feedback
        case notes
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let i = try c.decodeIfPresent(Int.self, forKey: .score) {
            score = Double(i)
        } else {
            score = try c.decodeIfPresent(Double.self, forKey: .score)
        }
        let fb = try c.decodeIfPresent(String.self, forKey: .feedback)
        let nt = try c.decodeIfPresent(String.self, forKey: .notes)
        feedback = fb ?? nt
    }
}
