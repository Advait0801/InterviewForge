//
//  APIService.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case unauthorized
    case badRequest(String)
    case notFound
    case serverError(String)
    case networkError(Error)
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL: "Invalid URL"
        case .unauthorized: "Session expired. Please log in again."
        case .badRequest(let msg): msg
        case .notFound: "Not found"
        case .serverError(let msg): msg
        case .networkError(let err): err.localizedDescription
        case .decodingError(let err): "Failed to parse response: \(err.localizedDescription)"
        }
    }
}

private struct APIErrorBody: Decodable {
    let error: String?
    let message: String?
}

final class APIService: Sendable {
    static let shared = APIService()

    // Change to your machine's local IP when running on simulator/device
    // e.g. "http://192.168.1.100:4000/api"
    let baseURL = "http://localhost:4000/api"

    private init() {}

    // MARK: - Public interface

    func request<T: Decodable>(
        method: String = "GET",
        path: String,
        queryItems: [URLQueryItem]? = nil,
        auth: Bool = false
    ) async throws -> T {
        let (data, _) = try await perform(method: method, path: path, bodyData: nil, queryItems: queryItems, auth: auth)
        return try decode(data)
    }

    func request<T: Decodable, B: Encodable>(
        method: String = "POST",
        path: String,
        body: B,
        queryItems: [URLQueryItem]? = nil,
        auth: Bool = false
    ) async throws -> T {
        let bodyData = try JSONEncoder().encode(body)
        let (data, _) = try await perform(method: method, path: path, bodyData: bodyData, queryItems: queryItems, auth: auth)
        return try decode(data)
    }

    func requestVoid(
        method: String = "POST",
        path: String,
        queryItems: [URLQueryItem]? = nil,
        auth: Bool = false
    ) async throws {
        _ = try await perform(method: method, path: path, bodyData: nil, queryItems: queryItems, auth: auth)
    }

    func requestVoid<B: Encodable>(
        method: String = "POST",
        path: String,
        body: B,
        queryItems: [URLQueryItem]? = nil,
        auth: Bool = false
    ) async throws {
        let bodyData = try JSONEncoder().encode(body)
        _ = try await perform(method: method, path: path, bodyData: bodyData, queryItems: queryItems, auth: auth)
    }

    // MARK: - Private

    private func perform(
        method: String,
        path: String,
        bodyData: Data?,
        queryItems: [URLQueryItem]?,
        auth: Bool
    ) async throws -> (Data, HTTPURLResponse) {
        guard var components = URLComponents(string: "\(baseURL)\(path)") else {
            throw APIError.invalidURL
        }
        if let queryItems, !queryItems.isEmpty {
            components.queryItems = queryItems
        }
        guard let url = components.url else {
            throw APIError.invalidURL
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = method
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if auth, let token = KeychainHelper.readString(for: "jwt_token") {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        urlRequest.httpBody = bodyData

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: urlRequest)
        } catch {
            throw APIError.networkError(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.serverError("Invalid response")
        }

        switch http.statusCode {
        case 200...299:
            return (data, http)
        case 401:
            throw APIError.unauthorized
        case 400:
            throw APIError.badRequest(extractMessage(from: data) ?? "Bad request")
        case 404:
            throw APIError.notFound
        default:
            throw APIError.serverError(extractMessage(from: data) ?? "Server error (\(http.statusCode))")
        }
    }

    private func decode<T: Decodable>(_ data: Data) throws -> T {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    private func extractMessage(from data: Data) -> String? {
        let body = try? JSONDecoder().decode(APIErrorBody.self, from: data)
        return body?.error ?? body?.message
    }
}
