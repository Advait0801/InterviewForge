//
//  DifficultyBadge.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import SwiftUI

struct DifficultyBadge: View {
    let difficulty: String

    private var color: Color { IFTheme.difficultyColor(difficulty) }

    var body: some View {
        Text(difficulty.capitalized)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .foregroundStyle(color)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }
}
