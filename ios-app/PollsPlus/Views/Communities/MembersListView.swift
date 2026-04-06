import SwiftUI

struct MembersListView: View {
    @EnvironmentObject var network: NetworkManager
    let communityId: Int
    let isFounder: Bool

    @State private var members: [CommunityMember] = []
    @State private var isLoading = true

    var body: some View {
        List {
            if isLoading {
                ProgressView().frame(maxWidth: .infinity).listRowSeparator(.hidden)
            } else if members.isEmpty {
                Text("No members yet").foregroundStyle(.secondary).listRowSeparator(.hidden)
            } else {
                ForEach(members) { member in
                    HStack(spacing: 12) {
                        NavigationLink {
                            ProfileView(userId: member.id)
                        } label: {
                            HStack(spacing: 12) {
                                CategoryIcon(category: member.category, size: 36)
                                Text(member.username)
                                    .font(.subheadline.bold())
                            }
                        }

                        Spacer()

                        if isFounder && member.id != network.currentUserId {
                            Button {
                                Task { await removeMember(member.id) }
                            } label: {
                                Text("Remove")
                                    .font(.caption)
                                    .foregroundStyle(.red)
                            }
                        }
                    }
                }
            }
        }
        .listStyle(.plain)
        .task { await loadMembers() }
    }

    private func loadMembers() async {
        do {
            let resp = try await network.getCommunityMembers(id: communityId)
            members = resp.members
        } catch {}
        isLoading = false
    }

    private func removeMember(_ userId: Int) async {
        do {
            try await network.removeMember(communityId: communityId, userId: userId)
            members.removeAll { $0.id == userId }
        } catch {}
    }
}

struct PendingRequestsView: View {
    @EnvironmentObject var network: NetworkManager
    let communityId: Int

    @State private var pending: [CommunityMember] = []
    @State private var isLoading = true

    var body: some View {
        List {
            if isLoading {
                ProgressView().frame(maxWidth: .infinity).listRowSeparator(.hidden)
            } else if pending.isEmpty {
                Text("No pending requests").foregroundStyle(.secondary).listRowSeparator(.hidden)
            } else {
                ForEach(pending) { member in
                    HStack(spacing: 12) {
                        CategoryIcon(category: member.category, size: 36)
                        Text(member.username)
                            .font(.subheadline.bold())
                        Spacer()
                        Button {
                            Task { await approve(member.id) }
                        } label: {
                            Text("Approve")
                                .font(.caption.bold())
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(.blue)
                                .foregroundColor(.white)
                                .clipShape(Capsule())
                        }
                    }
                }
            }
        }
        .listStyle(.plain)
        .task { await loadPending() }
    }

    private func loadPending() async {
        do {
            let resp = try await network.getPendingRequests(id: communityId)
            pending = resp.pending
        } catch {}
        isLoading = false
    }

    private func approve(_ userId: Int) async {
        do {
            try await network.approveRequest(communityId: communityId, userId: userId)
            pending.removeAll { $0.id == userId }
        } catch {}
    }
}
