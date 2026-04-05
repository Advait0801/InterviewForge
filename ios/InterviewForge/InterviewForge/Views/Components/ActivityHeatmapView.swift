//
//  ActivityHeatmapView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import SwiftUI

struct ActivityHeatmapView: View {
    let entries: [HeatmapEntry]
    var weeks: Int = 20

    private let cellSize: CGFloat = 13
    private let spacing: CGFloat = 3
    private let daysInWeek = 7

    private var grid: [[Int]] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: .now)
        let totalDays = weeks * daysInWeek
        let startDate = calendar.date(byAdding: .day, value: -(totalDays - 1), to: today)!

        let lookup: [String: Int] = Dictionary(
            entries.map { ($0.date, $0.count) },
            uniquingKeysWith: { $1 }
        )

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"

        var columns: [[Int]] = []
        var currentWeek: [Int] = []

        for i in 0..<totalDays {
            guard let date = calendar.date(byAdding: .day, value: i, to: startDate) else { continue }
            let key = formatter.string(from: date)
            let count = lookup[key] ?? 0
            currentWeek.append(count)
            if currentWeek.count == daysInWeek {
                columns.append(currentWeek)
                currentWeek = []
            }
        }
        if !currentWeek.isEmpty {
            columns.append(currentWeek)
        }
        return columns
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: spacing) {
                ForEach(Array(grid.enumerated()), id: \.offset) { _, week in
                    VStack(spacing: spacing) {
                        ForEach(0..<week.count, id: \.self) { day in
                            RoundedRectangle(cornerRadius: 2)
                                .fill(colorForCount(week[day]))
                                .frame(width: cellSize, height: cellSize)
                        }
                    }
                }
            }
            .padding(.horizontal, 4)
        }
    }

    private func colorForCount(_ count: Int) -> Color {
        switch count {
        case 0: Color(.systemGray5)
        case 1...2: Color.green.opacity(0.35)
        case 3...4: Color.green.opacity(0.6)
        default: Color.green.opacity(0.85)
        }
    }
}
