import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var network: NetworkManager
    @State private var showCreateDebate = false
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            FeedView()
                .tabItem { Label("Feed", systemImage: "flame.fill") }
                .tag(0)

            SearchView()
                .tabItem { Label("Search", systemImage: "magnifyingglass") }
                .tag(1)

            Text("")
                .tabItem { Label("Post", systemImage: "plus.circle.fill") }
                .tag(2)

            NotificationsView()
                .tabItem { Label("Alerts", systemImage: "bell.fill") }
                .tag(3)

            NavigationStack {
                if let userId = network.currentUserId {
                    ProfileView(userId: userId)
                }
            }
            .tabItem { Label("Profile", systemImage: "person.fill") }
            .tag(4)
        }
        .onChange(of: selectedTab) { _, newValue in
            if newValue == 2 {
                showCreateDebate = true
                selectedTab = 0
            }
        }
        .sheet(isPresented: $showCreateDebate) {
            CreateDebateView()
        }
    }
}
