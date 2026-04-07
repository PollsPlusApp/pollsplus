import SwiftUI

struct NotificationsView: View {
    @EnvironmentObject var network: NetworkManager
    @State private var notifications: [AppNotification] = []
    @State private var unreadCount = 0
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            List {
                if isLoading {
                    ProgressView().frame(maxWidth: .infinity).listRowSeparator(.hidden)
                } else if notifications.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "bell.slash")
                            .font(.system(size: 40))
                            .foregroundStyle(.secondary)
                        Text("No notifications")
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 40)
                    .listRowSeparator(.hidden)
                } else {
                    ForEach(notifications) { notif in
                        NavigationLink {
                            ProfileView(userId: notif.fromUserId)
                        } label: {
                            HStack(spacing: 12) {
                                CategoryIcon(category: notif.fromUserCategory, size: 40)

                                VStack(alignment: .leading, spacing: 4) {
                                    HStack(spacing: 4) {
                                        Text(notif.fromUsername)
                                            .font(.subheadline.bold())
                                        Text(notificationText(notif.type))
                                            .font(.subheadline)
                                    }
                                    Text(notif.timeAgo)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }

                                Spacer()

                                if !notif.read {
                                    Circle()
                                        .fill(.blue)
                                        .frame(width: 8, height: 8)
                                }
                            }
                        }
                    }
                }
            }
            .listStyle(.plain)
            .navigationTitle("Notifications")
            .toolbar {
                if unreadCount > 0 {
                    ToolbarItem(placement: .primaryAction) {
                        Button("Read All") {
                            Task { await markAllRead() }
                        }
                        .font(.subheadline)
                    }
                }
            }
            .task { await loadNotifications() }
            .refreshable { await loadNotifications() }
        }
    }

    private func loadNotifications() async {
        do {
            let resp = try await network.getNotifications()
            notifications = resp.notifications
            unreadCount = resp.unreadCount
        } catch {}
        isLoading = false
    }

    private func markAllRead() async {
        do {
            try await network.markNotificationsRead()
            unreadCount = 0
            // Reload to update read states
            await loadNotifications()
        } catch {}
    }

    private func notificationText(_ type: String) -> String {
        switch type {
        case "new_follower": return "followed you"
        case "debate_comment": return "commented on your debate"
        case "comment_reply": return "replied to your comment"
        default: return "interacted with you"
        }
    }
}
