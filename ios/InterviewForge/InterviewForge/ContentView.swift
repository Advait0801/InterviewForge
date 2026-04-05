//
//  ContentView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/5/26.
//

import SwiftUI

struct ContentView: View {
    @Environment(AuthManager.self) private var auth

    var body: some View {
        Group {
            if auth.isLoading {
                LaunchScreen()
            } else if auth.isAuthenticated {
                MainTabView()
                    .transition(.opacity)
            } else {
                LoginView()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: auth.isAuthenticated)
        .animation(.easeInOut(duration: 0.3), value: auth.isLoading)
        .task {
            await auth.checkAuth()
        }
    }
}

private struct LaunchScreen: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "hammer.fill")
                .font(.system(size: 56))
                .foregroundStyle(IFTheme.accentGradient)
            Text("InterviewForge")
                .font(.title.bold())
            ProgressView()
                .padding(.top, 8)
        }
    }
}
