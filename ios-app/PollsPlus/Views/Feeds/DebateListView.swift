import SwiftUI

enum FeedType: Hashable {
    case popular, following, communities, category(String)
    case userDebates(Int)
    case communityDebates(Int)
    case votedDebates
    case pinnedDebates
}

struct DebateListView: View {
    @EnvironmentObject var network: NetworkManager
    let feedType: FeedType

    @State private var debates: [Debate] = []
    @State private var isLoading = false
    @State private var page = 1
    @State private var hasMore = true
    @State private var error: String?
    @State private var navigateToProfile: Int?
    @State private var navigateToCommunity: Int?

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                contentView
            }
            .padding(.vertical, 8)
        }
        .refreshable {
            await refresh()
        }
        .task {
            if debates.isEmpty { await loadDebates() }
        }
        .navigationDestination(item: $navigateToProfile) { userId in
            ProfileView(userId: userId)
        }
        .navigationDestination(item: $navigateToCommunity) { communityId in
            CommunityDetailView(communityId: communityId)
        }
    }

    // MARK: - Extracted Subviews

    @ViewBuilder
    private var contentView: some View {
        if isLoading && debates.isEmpty {
            ProgressView()
                .padding(.top, 40)
        } else if debates.isEmpty && !isLoading {
            emptyState
        } else {
            debatesList
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text("No debates yet")
                .font(.headline)
                .foregroundStyle(.secondary)
        }
        .padding(.top, 60)
    }

    @ViewBuilder
    private var debatesList: some View {
        ForEach(Array(debates.enumerated()), id: \.element.id) { index, debate in
            debateRow(debate: debate, index: index)
        }

        if isLoading {
            ProgressView()
                .padding()
        }
    }

    private var showDeleteForOwnDebates: Bool {
        switch feedType {
        case .userDebates(let id): return id == network.currentUserId
        case .votedDebates: return false
        default: return false
        }
    }

    private func debateRow(debate: Debate, index: Int) -> some View {
        DebateCard(
            debate: debate,
            onVote: { optionId in
                Task { await voteOn(debate: debate, optionId: optionId, index: index) }
            },
            onDeleteVote: {
                Task { await deleteVoteOn(debate: debate, index: index) }
            },
            onTapAuthor: { userId in
                navigateToProfile = userId
            },
            onDelete: (showDeleteForOwnDebates || debate.authorId == network.currentUserId) ? {
                Task { await deleteDebate(debate: debate, index: index) }
            } : nil,
            onPin: {
                Task { await pinDebate(debate: debate, index: index) }
            },
            onUnpin: {
                Task { await unpinDebate(debate: debate, index: index) }
            },
            onTapCommunity: { communityId in
                navigateToCommunity = communityId
            }
        )
        .padding(.horizontal)
        .onAppear {
            markSeenIfNeeded(debate)
            if index == debates.count - 3 && hasMore && !isLoading {
                loadMore()
            }
        }
    }

    // MARK: - Data Loading

    private func loadDebates() async {
        isLoading = true
        error = nil
        do {
            let response = try await fetchDebates(page: page)
            debates = response.debates
            hasMore = response.debates.count >= 20
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func refresh() async {
        page = 1
        hasMore = true
        await loadDebates()
    }

    private func loadMore() {
        guard !isLoading, hasMore else { return }
        page += 1
        isLoading = true
        Task {
            do {
                let response = try await fetchDebates(page: page)
                debates.append(contentsOf: response.debates)
                hasMore = response.debates.count >= 20
            } catch {
                page -= 1
            }
            isLoading = false
        }
    }

    private func fetchDebates(page: Int) async throws -> DebatesResponse {
        switch feedType {
        case .popular: return try await network.feedPopular(page: page)
        case .following: return try await network.feedFollowing(page: page)
        case .communities: return try await network.feedCommunities(page: page)
        case .category(let cat): return try await network.feedCategory(cat, page: page)
        case .userDebates(let userId): return try await network.getUserDebates(id: userId, page: page)
        case .communityDebates(let communityId): return try await network.getCommunityDebates(id: communityId, page: page)
        case .votedDebates: return try await network.getVotedDebates(page: page)
        case .pinnedDebates: return try await network.getPinnedDebates(page: page)
        }
    }

    // MARK: - Voting

    private func voteOn(debate: Debate, optionId: Int, index: Int) async {
        do {
            try await network.vote(debateId: debate.id, optionId: optionId)
            let updated = try await network.getDebate(id: debate.id)
            if index < debates.count {
                debates[index] = updated
            }
        } catch {}
    }

    private func deleteVoteOn(debate: Debate, index: Int) async {
        do {
            try await network.deleteVote(debateId: debate.id)
            let updated = try await network.getDebate(id: debate.id)
            if index < debates.count {
                debates[index] = updated
            }
        } catch {}
    }

    private func pinDebate(debate: Debate, index: Int) async {
        do {
            try await network.pinDebate(debateId: debate.id)
            let updated = try await network.getDebate(id: debate.id)
            if index < debates.count { debates[index] = updated }
        } catch {}
    }

    private func unpinDebate(debate: Debate, index: Int) async {
        do {
            try await network.unpinDebate(debateId: debate.id)
            let updated = try await network.getDebate(id: debate.id)
            if index < debates.count { debates[index] = updated }
        } catch {}
    }

    private func deleteDebate(debate: Debate, index: Int) async {
        do {
            try await network.deleteDebate(id: debate.id)
            if index < debates.count {
                debates.remove(at: index)
            }
        } catch {}
    }

    private func markSeenIfNeeded(_ debate: Debate) {
        switch feedType {
        case .category, .popular:
            Task { try? await network.markSeen(debateId: debate.id) }
        default: break
        }
    }
}

// Make Int work with navigationDestination(item:)
extension Int: @retroactive Identifiable {
    public var id: Int { self }
}
