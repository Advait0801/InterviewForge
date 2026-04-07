//
//  SettingsView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import SwiftUI
import PhotosUI

struct SettingsView: View {
    @Environment(AuthManager.self) private var auth
    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var isChangingPassword = false
    @State private var passwordMessage: String?
    @State private var passwordIsError = false

    @State private var photoItem: PhotosPickerItem?
    @State private var isUploadingAvatar = false
    @State private var avatarMessage: String?

    var body: some View {
        List {
            profileSection
            avatarSection
            passwordSection
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var profileSection: some View {
        Section("Profile") {
            if let user = auth.currentUser {
                HStack(spacing: 14) {
                    AvatarImageView(urlString: user.avatarUrl, size: 56)
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

    private var avatarSection: some View {
        Section("Avatar") {
            PhotosPicker(selection: $photoItem, matching: .images) {
                Label("Choose photo", systemImage: "photo.on.rectangle.angled")
            }
            .onChange(of: photoItem) { _, new in
                Task { await uploadAvatar(item: new) }
            }

            if isUploadingAvatar {
                HStack {
                    ProgressView()
                    Text("Uploading…")
                        .font(.caption)
                }
            }

            if let avatarMessage {
                Text(avatarMessage)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Button("Remove avatar", role: .destructive) {
                Task { await removeAvatar() }
            }
        }
    }

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

    private func uploadAvatar(item: PhotosPickerItem?) async {
        guard let item else { return }
        isUploadingAvatar = true
        avatarMessage = nil
        defer { isUploadingAvatar = false }
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else { return }
            guard let compressed = UIImage(data: data)?.jpegData(compressionQuality: 0.7) else { return }
            guard compressed.count < 450_000 else {
                avatarMessage = "Image too large — pick a smaller photo."
                return
            }
            let b64 = compressed.base64EncodedString()
            let uri = "data:image/jpeg;base64,\(b64)"
            let body = AvatarUploadRequest(avatar: uri)
            try await APIService.shared.requestVoid(method: "POST", path: "/users/avatar", body: body, auth: true)
            Haptics.success()
            await auth.refreshUser()
            avatarMessage = "Avatar updated"
        } catch {
            avatarMessage = error.localizedDescription
            Haptics.error()
        }
    }

    private func removeAvatar() async {
        do {
            try await APIService.shared.requestVoid(method: "DELETE", path: "/users/avatar", auth: true)
            Haptics.light()
            await auth.refreshUser()
            avatarMessage = "Avatar removed"
        } catch {
            avatarMessage = error.localizedDescription
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
            Haptics.success()
            currentPassword = ""
            newPassword = ""
            confirmPassword = ""
        } catch {
            passwordMessage = error.localizedDescription
            passwordIsError = true
            Haptics.error()
        }
    }
}

private struct AvatarUploadRequest: Encodable {
    let avatar: String
}

private struct ChangePasswordRequest: Encodable {
    let currentPassword: String
    let newPassword: String
}
