import SwiftUI

enum UserListMode {
    case followers, following
}

struct UserListView: View {
    @EnvironmentObject var network: NetworkManager
    let userId: Int
    let mode: UserListMode

    @State private var users: [User] = []
    @State private var isLoading = true

    var body: some View {
        List {
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .listRowSeparator(.hidden)
            } else if users.isEmpty {
                Text("No \(mode == .followers ? "followers" : "following") yet")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .listRowSeparator(.hidden)
            } else {
                ForEach(users) { user in
                    NavigationLink {
                        ProfileView(userId: user.id)
                    } label: {
                        HStack(spacing: 12) {
                            CategoryIcon(category: user.category, size: 36)
                            Text(user.username)
                                .font(.subheadline.bold())
                            Spacer()
                        }
                    }
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle(mode == .followers ? "Followers" : "Following")
        .task { await loadUsers() }
    }

    private func loadUsers() async {
        do {
            let response = mode == .followers
                ? try await network.getFollowers(userId: userId)
                : try await network.getFollowing(userId: userId)
            users = response.users
        } catch {}
        isLoading = false
    }
}
