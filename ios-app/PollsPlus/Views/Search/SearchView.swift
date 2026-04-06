import SwiftUI

struct SearchView: View {
    @EnvironmentObject var network: NetworkManager
    @State private var query = ""
    @State private var users: [User] = []
    @State private var communities: [Community] = []
    @State private var debates: [Debate] = []
    @State private var isSearching = false
    @State private var hasSearched = false
    @State private var searchTask: Task<Void, Never>?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                searchBar
                resultsList
            }
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    // MARK: - Search Bar

    private var searchBar: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
            TextField("Search users, communities, debates...", text: $query)
                .autocapitalization(.none)
                .disableAutocorrection(true)
                .onChange(of: query) { _, newValue in
                    debounceSearch(newValue)
                }
            if !query.isEmpty {
                Button {
                    query = ""
                    clearResults()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(12)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    // MARK: - Results

    private var resultsList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                if isSearching {
                    ProgressView()
                        .padding(.top, 40)
                } else if !hasSearched {
                    emptyPrompt
                } else if users.isEmpty && communities.isEmpty && debates.isEmpty {
                    noResults
                } else {
                    if !users.isEmpty { usersSection }
                    if !communities.isEmpty { communitiesSection }
                    if !debates.isEmpty { debatesSection }
                }
            }
        }
    }

    private var emptyPrompt: some View {
        VStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 44))
                .foregroundStyle(.quaternary)
            Text("Find people, communities, and debates")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(.top, 80)
    }

    private var noResults: some View {
        VStack(spacing: 12) {
            Image(systemName: "questionmark.circle")
                .font(.system(size: 44))
                .foregroundStyle(.quaternary)
            Text("No results for \"\(query)\"")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(.top, 80)
    }

    // MARK: - Sections

    private var usersSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader(title: "People", icon: "person.fill", count: users.count)
            ForEach(users) { user in
                NavigationLink {
                    ProfileView(userId: user.id)
                } label: {
                    SearchUserRow(user: user)
                }
                Divider().padding(.leading, 68)
            }
        }
    }

    private var communitiesSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader(title: "Communities", icon: "person.3.fill", count: communities.count)
            ForEach(communities) { community in
                NavigationLink {
                    CommunityDetailView(communityId: community.id)
                } label: {
                    SearchCommunityRow(community: community)
                }
                Divider().padding(.leading, 68)
            }
        }
    }

    private var debatesSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            sectionHeader(title: "Debates", icon: "chart.bar.fill", count: debates.count)
            ForEach(debates) { debate in
                DebateCard(
                    debate: debate,
                    onVote: { optionId in Task { await vote(debate: debate, optionId: optionId) } },
                    onDeleteVote: { Task { await deleteVote(debate: debate) } },
                    onTapAuthor: nil
                )
                .padding(.horizontal)
                .padding(.vertical, 6)
            }
        }
    }

    private func sectionHeader(title: String, icon: String, count: Int) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.caption)
            Text(title)
                .font(.subheadline.bold())
            Text("(\(count))")
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .foregroundStyle(.secondary)
        .padding(.horizontal)
        .padding(.vertical, 10)
        .background(Color(.systemGray6).opacity(0.5))
    }

    // MARK: - Actions

    private func debounceSearch(_ text: String) {
        searchTask?.cancel()
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else {
            clearResults()
            return
        }
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard !Task.isCancelled else { return }
            await performSearch(text)
        }
    }

    private func performSearch(_ text: String) async {
        isSearching = true
        do {
            let resp = try await network.search(query: text)
            users = resp.users
            communities = resp.communities
            debates = resp.debates
            hasSearched = true
        } catch {}
        isSearching = false
    }

    private func clearResults() {
        users = []
        communities = []
        debates = []
        hasSearched = false
    }

    private func vote(debate: Debate, optionId: Int) async {
        do {
            try await network.vote(debateId: debate.id, optionId: optionId)
            if let idx = debates.firstIndex(where: { $0.id == debate.id }) {
                debates[idx] = try await network.getDebate(id: debate.id)
            }
        } catch {}
    }

    private func deleteVote(debate: Debate) async {
        do {
            try await network.deleteVote(debateId: debate.id)
            if let idx = debates.firstIndex(where: { $0.id == debate.id }) {
                debates[idx] = try await network.getDebate(id: debate.id)
            }
        } catch {}
    }
}

// MARK: - Row Views

struct SearchUserRow: View {
    let user: User

    var body: some View {
        HStack(spacing: 14) {
            CategoryIcon(category: user.category, size: 42)
            Text(user.username)
                .font(.body.weight(.medium))
                .foregroundStyle(.primary)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption2)
                .foregroundStyle(.quaternary)
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
    }
}

struct SearchCommunityRow: View {
    let community: Community

    var body: some View {
        HStack(spacing: 14) {
            CategoryIcon(category: community.category, size: 42)
            VStack(alignment: .leading, spacing: 2) {
                Text(community.name)
                    .font(.body.weight(.medium))
                    .foregroundStyle(.primary)
                Text("\(community.memberCount ?? 0) members")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if community.isMember == true {
                Text("Joined")
                    .font(.caption2.bold())
                    .foregroundStyle(.green)
            }
            Image(systemName: "chevron.right")
                .font(.caption2)
                .foregroundStyle(.quaternary)
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
    }
}
