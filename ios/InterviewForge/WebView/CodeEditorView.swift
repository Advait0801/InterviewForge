import SwiftUI
import WebKit

struct CodeEditorView: UIViewRepresentable {
    @Binding var code: String
    var language: String = "python"
    var theme: String = "dark"

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.userContentController.add(context.coordinator, name: "codeChanged")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.navigationDelegate = context.coordinator
        context.coordinator.webView = webView

        if let htmlPath = Bundle.main.path(forResource: "editor", ofType: "html") {
            let htmlURL = URL(fileURLWithPath: htmlPath)
            webView.loadFileURL(htmlURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())
        } else {
            let htmlString = Self.fallbackHTML
            webView.loadHTMLString(htmlString, baseURL: nil)
        }

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        let coord = context.coordinator
        if coord.lastSetLanguage != language {
            coord.lastSetLanguage = language
            webView.evaluateJavaScript("window.editorAPI.setLanguage('\(language)')")
        }
        if coord.lastSetTheme != theme {
            coord.lastSetTheme = theme
            webView.evaluateJavaScript("window.editorAPI.setTheme('\(theme)')")
        }
        if coord.needsInitialCode && coord.pageLoaded {
            coord.needsInitialCode = false
            let escaped = code.replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "'", with: "\\'")
                .replacingOccurrences(of: "\n", with: "\\n")
                .replacingOccurrences(of: "\r", with: "")
            webView.evaluateJavaScript("window.editorAPI.setCode('\(escaped)')")
        }
    }

    class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        var parent: CodeEditorView
        weak var webView: WKWebView?
        var pageLoaded = false
        var needsInitialCode = true
        var lastSetLanguage = ""
        var lastSetTheme = ""
        private var suppressUpdate = false

        init(_ parent: CodeEditorView) {
            self.parent = parent
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "codeChanged", let code = message.body as? String {
                suppressUpdate = true
                DispatchQueue.main.async {
                    self.parent.code = code
                    self.suppressUpdate = false
                }
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            pageLoaded = true
            let escaped = parent.code.replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "'", with: "\\'")
                .replacingOccurrences(of: "\n", with: "\\n")
                .replacingOccurrences(of: "\r", with: "")
            webView.evaluateJavaScript("window.editorAPI.setCode('\(escaped)')")
            webView.evaluateJavaScript("window.editorAPI.setLanguage('\(parent.language)')")
            webView.evaluateJavaScript("window.editorAPI.setTheme('\(parent.theme)')")
            needsInitialCode = false
        }
    }

    static let fallbackHTML = """
    <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{margin:0;background:#1e1e2e}textarea{width:100%;height:100%;background:#1e1e2e;color:#cdd6f4;
    font-family:monospace;font-size:14px;border:none;padding:12px;outline:none;resize:none;tab-size:4}</style>
    </head><body><textarea id="textarea" spellcheck="false"></textarea>
    <script>const t=document.getElementById('textarea');
    t.addEventListener('input',()=>{if(window.webkit)window.webkit.messageHandlers.codeChanged.postMessage(t.value)});
    window.editorAPI={setCode(c){t.value=c},getCode(){return t.value},setLanguage(l){},setTheme(th){
    if(th==='light'){t.style.background='#fff';t.style.color='#1e1e2e';document.body.style.background='#fff'}
    else{t.style.background='#1e1e2e';t.style.color='#cdd6f4';document.body.style.background='#1e1e2e'}}};
    </script></body></html>
    """
}
