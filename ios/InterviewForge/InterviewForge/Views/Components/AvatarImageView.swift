//
//  AvatarImageView.swift
//  InterviewForge
//
//  Created by Advait Naik on 4/6/26.
//

import SwiftUI
import UIKit

struct AvatarImageView: View {
    let urlString: String?
    var size: CGFloat = 56

    var body: some View {
        Group {
            if let ui = decodeDataURI(urlString) {
                Image(uiImage: ui)
                    .resizable()
                    .scaledToFill()
            } else if let urlString, let url = URL(string: urlString), urlString.hasPrefix("http") {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }

    private var placeholder: some View {
        Image(systemName: "person.circle.fill")
            .resizable()
            .foregroundStyle(.secondary.opacity(0.35))
    }

    private func decodeDataURI(_ s: String?) -> UIImage? {
        guard let s, let range = s.range(of: "base64,") else { return nil }
        let b64 = String(s[range.upperBound...])
        guard let data = Data(base64Encoded: b64) else { return nil }
        return UIImage(data: data)
    }
}
