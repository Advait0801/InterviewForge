//
//  SettingsView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import SwiftUI

struct SettingsView: View {
    @Environment(AuthManager.self) private var auth
    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var isChangingPassword = false
    @State private var passwordMessage: String?
    @State private var passwordIsError = false

    var body: some View {
        List {
            profileSection
            passwordSection
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Profile

    private var profileSection: some View {
        Section("Profile") {
            if let user = auth.currentUser {
                HStack(spacing: 14) {
                    AsyncImage(url: avatarURL(user)) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Image(systemName: "person.circle.fill")
                            .resizable()
                            .foregroundStyle(.secondary.opacity(0.4))
                    }
                    .frame(width: 56, height: 56)
                    .clipShape(Circle())

                    VStack(alignment: .leading, spacing: 4) {
                        Text(user.name ?? user.username)
                            .font(.headline)
                        Text("@\(user.username)")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        if let email = user.email {
                            Text(email)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }

    // MARK: - Password

    private var passwordSection: some View {
        Section("Change Password") {
            SecureField("Current password", text: $currentPassword)
            SecureField("New password", text: $newPassword)
            SecureField("Confirm new password", text: $confirmPassword)

            if let passwordMessage {
                Text(passwordMessage)
                    .font(.caption)
                    .foregroundStyle(passwordIsError ? .red : .green)
            }

            Button {
                Task { await changePassword() }
            } label: {
                if isChangingPassword {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else {
                    Text("Update Password")
                        .frame(maxWidth: .infinity)
                }
            }
            .disabled(
                currentPassword.isEmpty || newPassword.count < 6
                || newPassword != confirmPassword || isChangingPassword
            )
        }
    }

    private func changePassword() async {
        passwordMessage = nil
        isChangingPassword = true
        defer { isChangingPassword = false }
        do {
            let body = ChangePasswordRequest(currentPassword: currentPassword, newPassword: newPassword)
            try await APIService.shared.requestVoid(method: "POST", path: "/users/change-password", body: body, auth: true)
            passwordMessage = "Password updated successfully"
            passwordIsError = false
            currentPassword = ""
            newPassword = ""
            confirmPassword = ""
        } catch {
            passwordMessage = error.localizedDescription
            passwordIsError = true
        }
    }

    private func avatarURL(_ user: User) -> URL? {
        guard let urlString = user.avatarUrl else { return nil }
        return URL(string: urlString)
    }
}

private struct ChangePasswordRequest: Encodable {
    let currentPassword: String
    let newPassword: String
}
