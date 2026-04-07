import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var network: NetworkManager
    let userId: Int

    @State private var user: User?
    @State private var isLoading = true
    @State private var showReportAlert = false
    @State private var reportReason = ""
    @State private var showBlockConfirm = false
    @State private var showLogoutConfirm = false
    @State private var showChangeCategory = false
    @State private var selectedProfileTab = 0

    private var isOwnProfile: Bool { userId == network.currentUserId }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                if isLoading {
                    ProgressView()
                        .padding(.top, 60)
                } else if let user = user {
                    profileHeader(user)

                    if isOwnProfile {
                        profileTabs
                    }

                    Divider()

                    profileContent
                }
            }
        }
        .navigationTitle(user?.username ?? "Profile")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadUser() }
        .alert("Report User", isPresented: $showReportAlert) {
            TextField("Reason", text: $reportReason)
            Button("Submit") {
                Task {
                    try? await network.reportUser(userId: userId, reason: reportReason)
                    reportReason = ""
                }
            }
            Button("Cancel", role: .cancel) {}
        }
        .confirmationDialog("Are you sure?", isPresented: $showBlockConfirm) {
            Button(user?.isBlocked == true ? "Unblock" : "Block", role: .destructive) {
                Task { await toggleBlock() }
            }
        }
        .confirmationDialog("Are you sure you want to log out?", isPresented: $showLogoutConfirm, titleVisibility: .visible) {
            Button("Log Out", role: .destructive) {
                network.logout()
            }
        }
        .sheet(isPresented: $showChangeCategory) {
            ChangeCategoryView(currentCategory: user?.category ?? "General") {
                Task { await loadUser() }
            }
        }
    }

    // MARK: - Header

    @ViewBuilder
    private func profileHeader(_ user: User) -> some View {
        VStack(spacing: 12) {
            CategoryIcon(category: user.category, size: 80)

            Text(user.username)
                .font(.title2.bold())

            categoryBadgeRow(user)

            statsRow(user)

            if isOwnProfile {
                ownProfileActions
            } else {
                otherUserActions(user)
            }
        }
        .padding()
    }

    @ViewBuilder
    private func categoryBadgeRow(_ user: User) -> some View {
        HStack(spacing: 8) {
            CategoryBadge(category: user.category)
            if isOwnProfile {
                Button {
                    showChangeCategory = true
                } label: {
                    Image(systemName: "pencil.circle.fill")
                        .font(.caption)
                        .foregroundStyle(.blue)
                }
            }
        }
    }

    @ViewBuilder
    private func statsRow(_ user: User) -> some View {
        HStack(spacing: 32) {
            NavigationLink {
                UserListView(userId: userId, mode: .followers)
            } label: {
                statColumn(value: user.followerCount ?? 0, label: "Followers")
            }
            .foregroundStyle(.primary)

            NavigationLink {
                UserListView(userId: userId, mode: .following)
            } label: {
                statColumn(value: user.followingCount ?? 0, label: "Following")
            }
            .foregroundStyle(.primary)
        }
        .padding(.top, 4)
    }

    private func statColumn(value: Int, label: String) -> some View {
        VStack {
            Text("\(value)")
                .font(.title3.bold())
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Own Profile Actions

    private var ownProfileActions: some View {
        Button {
            showLogoutConfirm = true
        } label: {
            Text("Log Out")
                .font(.subheadline.bold())
                .frame(width: 120)
                .padding(.vertical, 10)
                .background(Color(.systemGray5))
                .foregroundStyle(.red)
                .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    // MARK: - Profile Tabs (own profile only)

    private var profileTabs: some View {
        HStack(spacing: 0) {
            ProfileTabButton(title: "My Debates", isSelected: selectedProfileTab == 0) {
                selectedProfileTab = 0
            }
            ProfileTabButton(title: "Voted", isSelected: selectedProfileTab == 1) {
                selectedProfileTab = 1
            }
            ProfileTabButton(title: "Pinned", isSelected: selectedProfileTab == 2) {
                selectedProfileTab = 2
            }
            ProfileTabButton(title: "Communities", isSelected: selectedProfileTab == 3) {
                selectedProfileTab = 3
            }
        }
        .padding(.horizontal)
        .padding(.top, 8)
    }

    @ViewBuilder
    private var profileContent: some View {
        switch selectedProfileTab {
        case 1:
            DebateListView(feedType: .votedDebates)
        case 2:
            DebateListView(feedType: .pinnedDebates)
        case 3:
            MyCommunitiesListView()
        default:
            DebateListView(feedType: .userDebates(userId))
        }
    }

    // MARK: - Other User Actions

    @ViewBuilder
    private func otherUserActions(_ user: User) -> some View {
        HStack(spacing: 12) {
            followButton(user)
            moreMenu(user)
        }
    }

    private func followButton(_ user: User) -> some View {
        Button {
            Task { await toggleFollow() }
        } label: {
            Text(user.isFollowing == true ? "Unfollow" : "Follow")
                .font(.subheadline.bold())
                .frame(width: 120)
                .padding(.vertical, 10)
                .background(user.isFollowing == true ? Color(.systemGray5) : .blue)
                .foregroundColor(user.isFollowing == true ? .primary : .white)
                .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    private func moreMenu(_ user: User) -> some View {
        Menu {
            Button(user.isBlocked == true ? "Unblock" : "Block", role: .destructive) {
                showBlockConfirm = true
            }
            Button("Report") {
                showReportAlert = true
            }
        } label: {
            Image(systemName: "ellipsis")
                .padding(10)
                .background(Color(.systemGray5))
                .clipShape(Circle())
        }
    }

    // MARK: - Actions

    private func loadUser() async {
        do {
            user = try await network.getUser(id: userId)
        } catch {}
        isLoading = false
    }

    private func toggleFollow() async {
        guard let u = user else { return }
        do {
            if u.isFollowing == true {
                try await network.unfollow(userId: userId)
            } else {
                try await network.follow(userId: userId)
            }
            user = try await network.getUser(id: userId)
        } catch {}
    }

    private func toggleBlock() async {
        guard let u = user else { return }
        do {
            if u.isBlocked == true {
                try await network.unblock(userId: userId)
            } else {
                try await network.block(userId: userId)
            }
            user = try await network.getUser(id: userId)
        } catch {}
    }
}

// MARK: - Profile Tab Button

struct ProfileTabButton: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13, weight: isSelected ? .bold : .medium))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
        }
        .foregroundColor(isSelected ? .primary : .secondary)
        .overlay(alignment: .bottom) {
            if isSelected {
                Rectangle()
                    .fill(.blue)
                    .frame(height: 2.5)
                    .clipShape(Capsule())
            }
        }
    }
}

// MARK: - My Communities List

struct MyCommunitiesListView: View {
    @EnvironmentObject var network: NetworkManager
    @State private var communities: [Community] = []
    @State private var isLoading = true

    var body: some View {
        LazyVStack(spacing: 0) {
            if isLoading {
                ProgressView()
                    .padding(.top, 40)
            } else if communities.isEmpty {
                emptyState
            } else {
                ForEach(communities) { community in
                    communityRow(community)
                }
            }
        }
        .task { await loadCommunities() }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "person.3")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text("No communities yet")
                .font(.headline)
                .foregroundStyle(.secondary)
        }
        .padding(.top, 60)
    }

    private func communityRow(_ community: Community) -> some View {
        NavigationLink {
            CommunityDetailView(communityId: community.id)
        } label: {
            HStack(spacing: 12) {
                CategoryIcon(category: community.category, size: 44)

                VStack(alignment: .leading, spacing: 4) {
                    Text(community.name)
                        .font(.subheadline.bold())
                        .foregroundStyle(.primary)
                    Text("\(community.memberCount ?? 0) members")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                if community.isFounder == true {
                    Text("Founder")
                        .font(.caption2)
                        .foregroundStyle(.blue)
                } else {
                    Button {
                        Task { await leave(community) }
                    } label: {
                        Text("Leave")
                            .font(.caption.bold())
                            .foregroundStyle(.red)
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 10)
        }
        Divider().padding(.leading, 68)
    }

    private func leave(_ community: Community) async {
        do {
            try await network.leaveCommunity(id: community.id)
            communities.removeAll { $0.id == community.id }
        } catch {}
    }

    private func loadCommunities() async {
        do {
            let resp = try await network.getMyCommunities()
            communities = resp.communities
        } catch {}
        isLoading = false
    }
}

// MARK: - Change Category View

struct ChangeCategoryView: View {
    @EnvironmentObject var network: NetworkManager
    @Environment(\.dismiss) var dismiss
    let currentCategory: String
    let onChanged: () -> Void

    @State private var selected: String = ""
    @State private var isLoading = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Text("Choose your new category")
                    .font(.headline)
                    .padding(.top)

                categoryList

                Spacer()
            }
            .navigationTitle("Change Category")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .onAppear { selected = currentCategory }
        }
    }

    private var categoryList: some View {
        VStack(spacing: 10) {
            ForEach(CategoryHelper.all, id: \.self) { cat in
                Button {
                    saveCategory(cat)
                } label: {
                    HStack(spacing: 14) {
                        CategoryIcon(category: cat, size: 40)
                        Text(cat)
                            .font(.body.weight(.medium))
                            .foregroundStyle(.primary)
                        Spacer()
                        if cat == currentCategory {
                            Text("Current")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                    .background(cat == selected ? Color.blue.opacity(0.1) : Color.clear)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(isLoading)
            }
        }
        .padding(.horizontal)
    }

    private func saveCategory(_ cat: String) {
        guard cat != currentCategory else { dismiss(); return }
        isLoading = true
        Task {
            do {
                try await network.updateCategory(cat)
                onChanged()
                dismiss()
            } catch {}
            isLoading = false
        }
    }
}
