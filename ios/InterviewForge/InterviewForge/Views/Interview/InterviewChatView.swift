//
//  InterviewChatView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import SwiftUI

struct InterviewChatView: View {
    let sessionId: String
    var preloadedVM: InterviewViewModel? = nil

    @State private var vm = InterviewViewModel()
    @State private var recorder = AudioRecorderService()
    @State private var answerText = ""
    @State private var showReport = false
    @State private var showEndConfirmation = false

    var body: some View {
        VStack(spacing: 0) {
            stageBar
            Divider()
            messagesScroll
            Divider()
            inputBar
        }
        .navigationTitle(vm.activeSession?.company.capitalized ?? "Interview")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if vm.isCompleted {
                    Button("Report") { showReport = true }
                } else {
                    Button("End") { showEndConfirmation = true }
                }
            }
        }
        .sheet(isPresented: $showReport) {
            InterviewReportView(vm: vm)
        }
        .confirmationDialog("End Interview?", isPresented: $showEndConfirmation) {
            Button("End & Generate Report", role: .destructive) {
                Task {
                    await vm.loadReport()
                    showReport = true
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will end the interview and generate your report.")
        }
        .task {
            if let pre = preloadedVM, pre.activeSession != nil {
                vm = pre
            } else {
                await vm.loadSession(id: sessionId)
            }
        }
    }

    // MARK: - Stage progress bar

    private var stageBar: some View {
        HStack(spacing: 0) {
            ForEach(Array(vm.stages.enumerated()), id: \.element) { idx, stage in
                let current = vm.stageIndex(vm.currentStage)
                let isActive = idx <= current

                VStack(spacing: 4) {
                    Circle()
                        .fill(isActive ? IFTheme.accent : Color(.systemGray4))
                        .frame(width: 10, height: 10)
                    Text(vm.stageDisplayName(stage))
                        .font(.system(size: 9, weight: isActive ? .semibold : .regular))
                        .foregroundStyle(isActive ? .primary : .secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                .frame(maxWidth: .infinity)

                if idx < vm.stages.count - 1 {
                    Rectangle()
                        .fill(idx < current ? IFTheme.accent : Color(.systemGray4))
                        .frame(height: 2)
                        .frame(maxWidth: 30)
                        .padding(.bottom, 14)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color(.secondarySystemBackground))
    }

    // MARK: - Messages

    private var messagesScroll: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(vm.messages) { message in
                        MessageBubble(message: message)
                            .id(message.id)
                    }

                    if vm.isAnswering {
                        HStack(spacing: 8) {
                            ProgressView()
                            Text("AI is thinking...")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding()
                        .id("loading")
                    }
                }
                .padding()
            }
            .onChange(of: vm.messages.count) { _, _ in
                withAnimation {
                    if let lastId = vm.messages.last?.id {
                        proxy.scrollTo(lastId, anchor: .bottom)
                    }
                }
            }
        }
    }

    // MARK: - Input bar

    private var inputBar: some View {
        VStack(spacing: 8) {
            // Transcription preview
            if let transcript = vm.transcription {
                HStack {
                    Text(transcript)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                    Spacer()
                    Button {
                        answerText = transcript
                        vm.transcription = nil
                    } label: {
                        Text("Use")
                            .font(.caption.weight(.semibold))
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.mini)
                }
                .padding(.horizontal)
            }

            HStack(spacing: 10) {
                // Voice record button
                voiceButton

                // Text field
                TextField("Type your answer...", text: $answerText, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(1...5)
                    .padding(10)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                // Send button
                Button {
                    let text = answerText
                    answerText = ""
                    vm.transcription = nil
                    Task { await vm.submitAnswer(text: text) }
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundStyle(IFTheme.accent)
                }
                .disabled(answerText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || vm.isAnswering)
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(.ultraThinMaterial)
    }

    private var voiceButton: some View {
        Group {
            if recorder.isRecording {
                Button {
                    recorder.stopRecording()
                    Task { await transcribeRecording() }
                } label: {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(.red)
                            .frame(width: 8, height: 8)
                        Text(recorder.formattedDuration)
                            .font(.caption.monospacedDigit())
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(.red.opacity(0.15))
                    .clipShape(Capsule())
                }
            } else if vm.isTranscribing {
                ProgressView()
                    .controlSize(.small)
                    .frame(width: 36)
            } else {
                Button {
                    recorder.clearRecording()
                    recorder.startRecording()
                } label: {
                    Image(systemName: "mic.fill")
                        .font(.body)
                        .frame(width: 36, height: 36)
                        .background(Color(.tertiarySystemFill))
                        .clipShape(Circle())
                }
            }
        }
    }

    private func transcribeRecording() async {
        guard let base64 = recorder.getBase64Audio() else { return }
        if let transcript = await vm.transcribeAudio(base64: base64) {
            answerText = transcript
        }
        recorder.clearRecording()
    }
}

// MARK: - Message Bubble

private struct MessageBubble: View {
    let message: InterviewMessage

    private var isAI: Bool { message.role != "user" }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            if !isAI { Spacer(minLength: 40) }

            if isAI {
                Image(systemName: "sparkles")
                    .font(.caption)
                    .foregroundStyle(IFTheme.accent)
                    .frame(width: 28, height: 28)
                    .background(IFTheme.accent.opacity(0.12))
                    .clipShape(Circle())
            }

            VStack(alignment: isAI ? .leading : .trailing, spacing: 4) {
                if let stage = message.stage {
                    Text(stage.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                }

                Text(message.content)
                    .font(.subheadline)
                    .padding(12)
                    .background(isAI ? IFTheme.cardBackground : IFTheme.accent.opacity(0.15))
                    .clipShape(RoundedRectangle(cornerRadius: 14))
            }

            if isAI { Spacer(minLength: 40) }
        }
    }
}
