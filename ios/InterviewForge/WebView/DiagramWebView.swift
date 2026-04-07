//
//  DiagramWebView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/6/26.
//

import SwiftUI
import WebKit

struct DiagramWebView: UIViewRepresentable {
    var nodes: [DiagramNode]
    var edges: [DiagramEdge]
    var theme: String = "dark"

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.navigationDelegate = context.coordinator
        context.coordinator.webView = webView

        if let path = Bundle.main.path(forResource: "diagram", ofType: "html") {
            let url = URL(fileURLWithPath: path)
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        let payload: [String: Any] = [
            "nodes": nodes.map { ["id": $0.id, "label": $0.label, "type": $0.type as Any] },
            "edges": edges.map { ["source": $0.source, "target": $0.target, "label": $0.label as Any] }
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        let escaped = json.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "'", with: "\\'")
        webView.evaluateJavaScript("window.diagramAPI.setTheme('\(theme)')")
        webView.evaluateJavaScript("window.diagramAPI.setData('\(escaped)')")
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        weak var webView: WKWebView?
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // Trigger update after load
        }
    }
}
