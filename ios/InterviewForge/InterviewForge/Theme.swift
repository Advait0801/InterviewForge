//
//  Theme.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import SwiftUI

enum IFTheme {
    static let accent = Color(red: 0.38, green: 0.36, blue: 0.96)  // Indigo-purple
    static let accentGradient = LinearGradient(
        colors: [Color(red: 0.38, green: 0.36, blue: 0.96), Color(red: 0.56, green: 0.28, blue: 0.92)],
        startPoint: .leading,
        endPoint: .trailing
    )

    static let easy = Color.green
    static let medium = Color.orange
    static let hard = Color.red

    static func difficultyColor(_ difficulty: String) -> Color {
        switch difficulty.lowercased() {
        case "easy": .green
        case "medium": .orange
        case "hard": .red
        default: .secondary
        }
    }

    static let cardBackground = Color(.secondarySystemBackground)
    static let cardCornerRadius: CGFloat = 16

    static func companyColor(_ company: String) -> Color {
        switch company.lowercased() {
        case "amazon": Color.orange
        case "google": Color.blue
        case "meta": Color(red: 0.0, green: 0.47, blue: 1.0)
        case "apple": Color.gray
        default: .secondary
        }
    }

    static func companyIcon(_ company: String) -> String {
        switch company.lowercased() {
        case "amazon": "shippingbox.fill"
        case "google": "magnifyingglass"
        case "meta": "globe"
        case "apple": "apple.logo"
        default: "building.2.fill"
        }
    }
}
