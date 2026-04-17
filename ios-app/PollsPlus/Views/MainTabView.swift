import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var network: NetworkManager
    @StateObject private var signupTrigger = SignupPromptTrigger.shared
    @State private var showCreateDebate = false
    @State private var showSignupPrompt = false
    @State private var selectedTab = 0

    private var isDemoMode: Bool { !network.isLoggedIn }

    var body: some View {
        VStack(spacing: 0) {
            if isDemoMode {
                demoBanner
            }
            tabContent
        }
        .sheet(isPresented: $showCreateDebate) {
            if isDemoMode {
                SignupPromptView(contextMessage: "Sign up to post debates")
            } else {
                CreateDebateView()
            }
        }
        .sheet(isPresented: $showSignupPrompt) {
            SignupPromptView()
        }
        .sheet(isPresented: $signupTrigger.show) {
            SignupPromptView(contextMessage: signupTrigger.message)
        }
    }

    private var demoBanner: some View {
        Button {
            showSignupPrompt = true
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "info.circle.fill")
                    .font(.caption)
                Text("Your votes aren't being saved — ")
                    .font(.caption)
                +
                Text("Sign up free")
                    .font(.caption.bold())
                    .foregroundColor(.white)
                Image(systemName: "arrow.right")
                    .font(.caption2.bold())
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(
                LinearGradient(colors: [.blue, .purple], startPoint: .leading, endPoint: .trailing)
            )
        }
    }

    private var tabContent: some View {
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

            CommunitiesView()
                .tabItem { Label("Groups", systemImage: "person.3.fill") }
                .tag(3)

            NavigationStack {
                if isDemoMode {
                    DemoProfileView()
                } else if let userId = network.currentUserId {
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
    }
}

/// Shown in the Profile tab when user hasn't signed up yet
struct DemoProfileView: View {
    @State private var showSignupPrompt = false

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            ZStack {
                Circle()
                    .fill(LinearGradient(colors: [.blue, .purple], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 100, height: 100)
                    .shadow(color: .blue.opacity(0.4), radius: 16)
                Image(systemName: "person.fill")
                    .font(.system(size: 48, weight: .bold))
                    .foregroundColor(.white)
            }

            VStack(spacing: 8) {
                Text("Create your profile")
                    .font(.title2.bold())
                Text("Save your votes, collect your pinned debates, and follow people who take great takes.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            Button {
                showSignupPrompt = true
            } label: {
                Text("Sign Up Free")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(LinearGradient(colors: [.blue, .purple], startPoint: .leading, endPoint: .trailing))
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .shadow(color: .blue.opacity(0.4), radius: 10, y: 4)
            }
            .padding(.horizontal, 32)

            Button {
                showSignupPrompt = true
            } label: {
                Text("Already have an account? Log in")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showSignupPrompt) {
            SignupPromptView()
        }
    }
}
