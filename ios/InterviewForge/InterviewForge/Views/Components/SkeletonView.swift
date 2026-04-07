//
//  SkeletonView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/6/26.
//

import SwiftUI

struct SkeletonView: View {
    @State private var phase: CGFloat = 0

    var body: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(Color(.systemGray5))
            .overlay {
                GeometryReader { geo in
                    LinearGradient(
                        colors: [
                            Color(.systemGray5),
                            Color(.systemGray4).opacity(0.6),
                            Color(.systemGray5)
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .offset(x: phase * geo.size.width * 2 - geo.size.width)
                }
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .onAppear {
                withAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}
