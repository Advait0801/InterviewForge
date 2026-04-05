//
//  InterviewForgeApp.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import SwiftUI

@main
struct InterviewForgeApp: App {
    @State private var authManager = AuthManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(authManager)
                .tint(IFTheme.accent)
        }
    }
}
