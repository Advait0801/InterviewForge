//
//  RegisterView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import SwiftUI

struct RegisterView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var username = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    private var isValid: Bool {
        !name.isEmpty && !username.isEmpty && !email.isEmpty
        && password.count >= 6 && password == confirmPassword
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                VStack(spacing: 8) {
                    Text("Create Account")
                        .font(.title.bold())
                    Text("Start your interview prep journey")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 16)

                VStack(spacing: 14) {
                    FormField(icon: "person.fill", placeholder: "Full name", text: $name)
                        .textContentType(.name)

                    FormField(icon: "at", placeholder: "Username", text: $username)
                        .textContentType(.username)
                        .textInputAutocapitalization(.never)

                    FormField(icon: "envelope.fill", placeholder: "Email", text: $email)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)

                    SecureFormField(icon: "lock.fill", placeholder: "Password (min 6 chars)", text: $password)
                        .textContentType(.newPassword)

                    SecureFormField(icon: "lock.rotation", placeholder: "Confirm password", text: $confirmPassword)
                        .textContentType(.newPassword)
                }

                if password != confirmPassword && !confirmPassword.isEmpty {
                    Text("Passwords don't match")
                        .font(.caption)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    Task { await register() }
                } label: {
                    Group {
                        if isLoading {
                            ProgressView().tint(.white)
                        } else {
                            Text("Create Account")
                                .fontWeight(.semibold)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                }
                .buttonStyle(.borderedProminent)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .disabled(!isValid || isLoading)
            }
            .padding(.horizontal, 28)
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    private func register() async {
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }
        do {
            try await auth.register(name: name, username: username, email: email, password: password)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Form field components

struct FormField: View {
    let icon: String
    let placeholder: String
    @Binding var text: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(.secondary)
                .frame(width: 20)
            TextField(placeholder, text: $text)
                .autocorrectionDisabled()
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct SecureFormField: View {
    let icon: String
    let placeholder: String
    @Binding var text: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(.secondary)
                .frame(width: 20)
            SecureField(placeholder, text: $text)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
