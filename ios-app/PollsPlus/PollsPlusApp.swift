import SwiftUI

@main
struct PollsPlusApp: App {
    @StateObject private var network = NetworkManager.shared

    var body: some Scene {
        WindowGroup {
            Group {
                if network.isLoggedIn {
                    MainTabView()
                } else {
                    LoginView()
                }
            }
            .environmentObject(network)
            .animation(.easeInOut, value: network.isLoggedIn)
        }
    }
}
