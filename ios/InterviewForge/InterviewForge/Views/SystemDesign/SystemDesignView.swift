//
//  SystemDesignView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/6/26.
//

import SwiftUI

struct SystemDesignView: View {
    @Environment(\.colorScheme) private var colorScheme
    @State private var vm = SystemDesignViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Describe your architecture in plain English. The AI extracts components, risks, and a rubric.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(vm.presetPrompts, id: \.self) { p in
                            Button {
                                vm.prompt = p
                            } label: {
                                Text(p)
                                    .font(.caption)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(IFTheme.cardBackground)
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Prompt").font(.headline)
                    TextField("What are you designing?", text: $vm.prompt, axis: .vertical)
                        .lineLimit(2...6)
                        .padding(12)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Your explanation").font(.headline)
                    TextField("Walk through components, data flow, tradeoffs…", text: $vm.explanation, axis: .vertical)
                        .lineLimit(6...20)
                        .padding(12)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                Menu {
                    Button("Any company") { vm.company = nil }
                    Button("Amazon") { vm.company = "amazon" }
                    Button("Google") { vm.company = "google" }
                    Button("Meta") { vm.company = "meta" }
                    Button("Apple") { vm.company = "apple" }
                } label: {
                    HStack {
                        Text("Company context")
                        Spacer()
                        Text(vm.company?.capitalized ?? "None")
                            .foregroundStyle(.secondary)
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.caption)
                    }
                    .padding()
                    .background(IFTheme.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                if let err = vm.error {
                    Text(err).font(.caption).foregroundStyle(.red)
                }

                Button {
                    Task { await vm.analyze() }
                } label: {
                    Group {
                        if vm.isAnalyzing {
                            ProgressView().tint(.white)
                        } else {
                            Label("Analyze design", systemImage: "sparkles")
                                .fontWeight(.semibold)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                }
                .buttonStyle(.borderedProminent)
                .disabled(vm.isAnalyzing)

                if let r = vm.result {
                    resultSections(r)
                }
            }
            .padding()
        }
        .navigationTitle("System Design")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private func resultSections(_ r: SystemDesignResult) -> some View {
        if let summary = r.summary {
            VStack(alignment: .leading, spacing: 8) {
                Text("Summary").font(.headline)
                Text(summary).font(.subheadline)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(IFTheme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: IFTheme.cardCornerRadius))
        }

        if let nodes = r.nodes, !nodes.isEmpty, let edges = r.edges {
            VStack(alignment: .leading, spacing: 8) {
                Text("Architecture").font(.headline)
                DiagramWebView(
                    nodes: nodes,
                    edges: edges,
                    theme: colorScheme == .dark ? "dark" : "light"
                )
                .frame(height: 280)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }

        if let risks = r.risks, !risks.isEmpty {
            bulletList(title: "Risks", items: risks, icon: "exclamationmark.triangle.fill", color: .orange)
        }

        if let imp = r.improvements, !imp.isEmpty {
            bulletList(title: "Improvements", items: imp, icon: "arrow.up.circle.fill", color: .blue)
        }

        if let rubric = r.rubric, !rubric.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Rubric").font(.headline)
                ForEach(Array(rubric.keys.sorted()), id: \.self) { key in
                    if let rs = rubric[key] {
                        HStack {
                            Text(key.replacingOccurrences(of: "_", with: " ").capitalized)
                                .font(.subheadline)
                            Spacer()
                            if let s = rs.score {
                                Text(String(format: "%.1f", s))
                                    .font(.subheadline.bold().monospacedDigit())
                            }
                        }
                        if let fb = rs.feedback {
                            Text(fb).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .padding()
            .background(IFTheme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: IFTheme.cardCornerRadius))
        }
    }

    private func bulletList(title: String, items: [String], icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            ForEach(items, id: \.self) { item in
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: icon).foregroundStyle(color).font(.caption)
                    Text(item).font(.subheadline)
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(IFTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: IFTheme.cardCornerRadius))
    }
}
