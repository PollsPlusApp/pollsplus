import SwiftUI

struct CommunitiesView: View {
    @EnvironmentObject var network: NetworkManager
    @State private var selectedCategory = "Sports"
    @State private var communities: [Community] = []
    @State private var isLoading = true
    @State private var showCreateCommunity = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                categoryTabs
                communityContent
            }
            .navigationTitle("Communities")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showCreateCommunity = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                    }
                }
            }
            .sheet(isPresented: $showCreateCommunity) {
                CreateCommunityView()
                    .onDisappear { Task { await loadCommunities() } }
            }
            .task { await loadCommunities() }
        }
    }

    // MARK: - Extracted Subviews

    private var categoryTabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(CategoryHelper.all, id: \.self) { cat in
                    CommunityCategoryTab(
                        category: cat,
                        isSelected: selectedCategory == cat
                    ) {
                        selectedCategory = cat
                        Task { await loadCommunities() }
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
    }

    @ViewBuilder
    private var communityContent: some View {
        if isLoading {
            Spacer()
            ProgressView()
            Spacer()
        } else if communities.isEmpty {
            Spacer()
            emptyState
            Spacer()
        } else {
            communityList
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "person.3")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text("No communities in \(selectedCategory)")
                .foregroundStyle(.secondary)
            Button("Create One") {
                showCreateCommunity = true
            }
            .buttonStyle(.borderedProminent)
        }
    }

    private var communityList: some View {
        List(communities) { community in
            NavigationLink {
                CommunityDetailView(communityId: community.id)
            } label: {
                CommunityRow(community: community)
            }
        }
        .listStyle(.plain)
    }

    // MARK: - Actions

    private func loadCommunities() async {
        isLoading = true
        do {
            let response = try await network.browseCommunities(category: selectedCategory)
            communities = response.communities
        } catch {}
        isLoading = false
    }
}

// MARK: - Supporting Views

struct CommunityCategoryTab: View {
    let category: String
    let isSelected: Bool
    let action: () -> Void

    private var catColor: Color { CategoryHelper.color(for: category) }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: CategoryHelper.icon(for: category))
                    .font(.system(size: 10, weight: .bold))
                Text(category)
                    .font(.system(size: 12, weight: isSelected ? .bold : .medium))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(isSelected ? catColor : catColor.opacity(0.1))
            .foregroundColor(isSelected ? .white : catColor)
            .clipShape(Capsule())
            .shadow(color: isSelected ? catColor.opacity(0.3) : .clear, radius: 4, y: 2)
        }
    }
}

struct CommunityRow: View {
    let community: Community

    var body: some View {
        HStack(spacing: 12) {
            CategoryIcon(category: community.category, size: 44)
            communityInfo
            Spacer()
        }
        .padding(.vertical, 4)
    }

    private var communityInfo: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(community.name)
                .font(.subheadline.bold())
            communityMeta
        }
    }

    private var communityMeta: some View {
        HStack(spacing: 8) {
            Text("\(community.memberCount ?? 0) members")
                .font(.caption)
                .foregroundStyle(.secondary)
            if community.isPrivate {
                Label("Private", systemImage: "lock.fill")
                    .font(.caption2)
                    .foregroundStyle(.orange)
            } else {
                Label("Public", systemImage: "lock.open.fill")
                    .font(.caption2)
                    .foregroundStyle(.green)
            }
            if community.isMember == true {
                Text("Joined")
                    .font(.caption2)
                    .foregroundStyle(.green)
            }
        }
    }
}
