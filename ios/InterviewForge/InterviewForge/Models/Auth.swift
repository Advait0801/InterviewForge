//
//  Auth.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation

struct LoginRequest: Encodable {
    let email: String
    let password: String
}

struct RegisterRequest: Encodable {
    let name: String
    let username: String
    let email: String
    let password: String
}

struct ForgotPasswordRequest: Encodable {
    let email: String
}

struct ResetPasswordRequest: Encodable {
    let token: String
    let newPassword: String
}

struct AuthResponse: Decodable {
    let token: String
}

struct MessageResponse: Decodable {
    let message: String?
}
