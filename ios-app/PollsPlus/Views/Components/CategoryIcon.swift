import SwiftUI

struct CategoryIcon: View {
    let category: String
    var size: CGFloat = 40

    var body: some View {
        ZStack {
            Circle()
                .fill(CategoryHelper.gradient(for: category))
                .frame(width: size, height: size)

            Image(systemName: CategoryHelper.icon(for: category))
                .font(.system(size: size * 0.4, weight: .semibold))
                .foregroundColor(.white)
        }
        .shadow(color: CategoryHelper.color(for: category).opacity(0.35), radius: size * 0.15, y: size * 0.05)
    }
}

struct CategoryBadge: View {
    let category: String

    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: CategoryHelper.icon(for: category))
                .font(.system(size: 9, weight: .bold))
            Text(category)
                .font(.system(size: 11, weight: .semibold))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(CategoryHelper.color(for: category).opacity(0.15))
        .foregroundStyle(CategoryHelper.color(for: category))
        .clipShape(Capsule())
    }
}
