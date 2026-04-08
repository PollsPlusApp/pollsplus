import SwiftUI

struct CommunityDetailView: View {
    @EnvironmentObject var network: NetworkManager
    let communityId: Int

    @State private var community: Community?
    @State private var isLoading = true
    @State private var showCreateDebate = false
    @State private var showMembers = false
    @State private var showPending = false
    @State private var showDeleteConfirm = false

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                if isLoading {
                    ProgressView()
                        .padding(.top, 60)
                } else if let community = community {
                    communityHeader(community)
                    Divider()
                    DebateListView(feedType: .communityDebates(communityId))
                }
            }
        }
        .navigationTitle(community?.name ?? "Community")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadCommunity() }
        .sheet(isPresented: $showCreateDebate) {
            CreateDebateView(preselectedCommunityId: communityId, preselectedCommunityName: community?.name, preselectedCommunityCategory: community?.category)
        }
        .sheet(isPresented: $showMembers) {
            membersSheet
        }
        .sheet(isPresented: $showPending) {
            pendingSheet
        }
        .confirmationDialog("Delete this community? All posts inside will be removed. This cannot be undone.", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
            Button("Delete Community", role: .destructive) {
                Task { await deleteCommunity() }
            }
        }
    }

    // MARK: - Extracted Subviews

    @ViewBuilder
    private func communityHeader(_ community: Community) -> some View {
        VStack(spacing: 12) {
            CategoryIcon(category: community.category, size: 70)

            Text(community.name)
                .font(.title2.bold())

            communityBadges(community)

            Text("\(community.memberCount ?? 0) members")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            if let founder = community.founderUsername {
                Text("Founded by \(founder)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            communityActions(community)
        }
        .padding()
    }

    @ViewBuilder
    private func communityBadges(_ community: Community) -> some View {
        HStack(spacing: 16) {
            CategoryBadge(category: community.category)
            if community.isPrivate {
                Label("Private", systemImage: "lock.fill")
                    .font(.caption)
                    .foregroundStyle(.orange)
            } else {
                Label("Public", systemImage: "lock.open.fill")
                    .font(.caption)
                    .foregroundStyle(.green)
            }
        }
    }

    @ViewBuilder
    private func communityActions(_ community: Community) -> some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                if community.isMember == true {
                    memberActions(community)
                } else if community.isPending == true {
                    pendingBadge
                } else {
                    joinButton
                }

                if community.isFounder == true {
                    membersButton
                    pendingButton
                }
            }

            if community.isFounder == true {
                founderManageRow(community)
            }
        }
    }

    @ViewBuilder
    private func founderManageRow(_ community: Community) -> some View {
        HStack(spacing: 12) {
            Button {
                Task { await togglePrivacy() }
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: community.isPrivate ? "lock.fill" : "lock.open.fill")
                        .font(.caption)
                    Text(community.isPrivate ? "Private" : "Public")
                        .font(.caption.bold())
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(community.isPrivate ? Color.orange.opacity(0.15) : Color.green.opacity(0.15))
                .foregroundStyle(community.isPrivate ? .orange : .green)
                .clipShape(Capsule())
            }

            Button {
                showDeleteConfirm = true
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "trash.fill")
                        .font(.caption)
                    Text("Delete")
                        .font(.caption.bold())
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Color.red.opacity(0.15))
                .foregroundStyle(.red)
                .clipShape(Capsule())
            }
        }
    }

    @ViewBuilder
    private func memberActions(_ community: Community) -> some View {
        Button {
            showCreateDebate = true
        } label: {
            Label("New Debate", systemImage: "plus")
                .font(.subheadline.bold())
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(.blue)
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 10))
        }

        if community.isFounder != true {
            Button {
                Task { await leaveCommunity() }
            } label: {
                Text("Leave")
                    .font(.subheadline.bold())
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Color(.systemGray5))
                    .foregroundStyle(.red)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
        }
    }

    private var pendingBadge: some View {
        Text("Request Pending")
            .font(.subheadline.bold())
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color(.systemGray5))
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private var joinButton: some View {
        Button {
            Task { await joinCommunity() }
        } label: {
            Text("Join")
                .font(.subheadline.bold())
                .padding(.horizontal, 24)
                .padding(.vertical, 10)
                .background(.blue)
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    private var membersButton: some View {
        Button {
            showMembers = true
        } label: {
            Image(systemName: "person.3.fill")
                .padding(10)
                .background(Color(.systemGray5))
                .clipShape(Circle())
        }
    }

    private var pendingButton: some View {
        Button {
            showPending = true
        } label: {
            Image(systemName: "person.badge.clock.fill")
                .padding(10)
                .background(Color(.systemGray5))
                .clipShape(Circle())
        }
    }

    private var membersSheet: some View {
        NavigationStack {
            MembersListView(communityId: communityId, isFounder: community?.isFounder == true)
                .navigationTitle("Members")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") { showMembers = false }
                    }
                }
        }
    }

    private var pendingSheet: some View {
        NavigationStack {
            PendingRequestsView(communityId: communityId)
                .navigationTitle("Pending Requests")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") { showPending = false }
                    }
                }
        }
    }

    // MARK: - Actions

    private func loadCommunity() async {
        do { community = try await network.getCommunity(id: communityId) } catch {}
        isLoading = false
    }

    private func joinCommunity() async {
        do {
            _ = try await network.joinCommunity(id: communityId)
            community = try await network.getCommunity(id: communityId)
        } catch {}
    }

    private func leaveCommunity() async {
        do {
            try await network.leaveCommunity(id: communityId)
            community = try await network.getCommunity(id: communityId)
        } catch {}
    }

    private func togglePrivacy() async {
        do {
            try await network.toggleCommunityPrivacy(id: communityId)
            community = try await network.getCommunity(id: communityId)
        } catch {}
    }

    @Environment(\.dismiss) private var dismiss

    private func deleteCommunity() async {
        do {
            try await network.deleteCommunity(id: communityId)
            dismiss()
        } catch {}
    }
}
