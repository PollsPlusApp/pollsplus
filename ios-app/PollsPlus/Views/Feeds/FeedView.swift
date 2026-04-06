import SwiftUI

struct FeedView: View {
    @EnvironmentObject var network: NetworkManager
    @State private var selectedTab = 0

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                feedTabs
                feedContent
            }
            .navigationTitle("PollsPlus")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var feedTabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                FeedTab(title: "Popular", icon: "flame.fill", color: .orange, isSelected: selectedTab == 0) { selectedTab = 0 }
                FeedTab(title: "Following", icon: "heart.fill", color: .pink, isSelected: selectedTab == 1) { selectedTab = 1 }
                FeedTab(title: "Communities", icon: "person.3.fill", color: .indigo, isSelected: selectedTab == 2) { selectedTab = 2 }
                ForEach(Array(CategoryHelper.all.enumerated()), id: \.offset) { index, cat in
                    FeedTab(
                        title: cat,
                        icon: CategoryHelper.icon(for: cat),
                        color: CategoryHelper.color(for: cat),
                        isSelected: selectedTab == index + 3
                    ) {
                        selectedTab = index + 3
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
        }
        .background(.ultraThinMaterial)
    }

    private var feedContent: some View {
        TabView(selection: $selectedTab) {
            DebateListView(feedType: .popular).tag(0)
            DebateListView(feedType: .following).tag(1)
            DebateListView(feedType: .communities).tag(2)
            ForEach(Array(CategoryHelper.all.enumerated()), id: \.offset) { index, cat in
                DebateListView(feedType: .category(cat)).tag(index + 3)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
    }
}

struct FeedTab: View {
    let title: String
    var icon: String? = nil
    let color: Color
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.system(size: 11, weight: .bold))
                }
                Text(title)
                    .font(.system(size: 13, weight: isSelected ? .bold : .medium))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(isSelected ? color : color.opacity(0.1))
            .foregroundColor(isSelected ? .white : color)
            .clipShape(Capsule())
            .shadow(color: isSelected ? color.opacity(0.3) : .clear, radius: 4, y: 2)
        }
    }
}
