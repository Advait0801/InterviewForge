//
//  AuthManager.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation
import SwiftUI

@Observable
@MainActor
final class AuthManager {
    var isAuthenticated = false
    var currentUser: User?
    var isLoading = true

    private let api = APIService.shared

    func checkAuth() async {
        guard KeychainHelper.readString(for: "jwt_token") != nil else {
            isLoading = false
            return
        }
        do {
            let me: MeResponse = try await api.request(path: "/users/me", auth: true)
            currentUser = me.user
            isAuthenticated = true
        } catch {
            KeychainHelper.delete(for: "jwt_token")
            isAuthenticated = false
        }
        isLoading = false
    }

    func login(email: String, password: String) async throws {
        let body = LoginRequest(email: email, password: password)
        let response: AuthResponse = try await api.request(method: "POST", path: "/auth/login", body: body)
        KeychainHelper.saveString(response.token, for: "jwt_token")
        let me: MeResponse = try await api.request(path: "/users/me", auth: true)
        currentUser = me.user
        isAuthenticated = true
    }

    func register(name: String, username: String, email: String, password: String) async throws {
        let body = RegisterRequest(name: name, username: username, email: email, password: password)
        let response: AuthResponse = try await api.request(method: "POST", path: "/auth/register", body: body)
        KeychainHelper.saveString(response.token, for: "jwt_token")
        let me: MeResponse = try await api.request(path: "/users/me", auth: true)
        currentUser = me.user
        isAuthenticated = true
    }

    func refreshUser() async {
        guard isAuthenticated else { return }
        do {
            let me: MeResponse = try await api.request(path: "/users/me", auth: true)
            currentUser = me.user
        } catch { /* ignore */ }
    }

    func forgotPassword(email: String) async throws {
        let body = ForgotPasswordRequest(email: email)
        try await api.requestVoid(method: "POST", path: "/auth/forgot-password", body: body)
    }

    func resetPassword(token: String, newPassword: String) async throws {
        let body = ResetPasswordRequest(token: token, newPassword: newPassword)
        try await api.requestVoid(method: "POST", path: "/auth/reset-password", body: body)
    }

    func logout() {
        KeychainHelper.delete(for: "jwt_token")
        currentUser = nil
        isAuthenticated = false
    }
}
