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
    let feedback: String?
}
