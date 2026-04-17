import SwiftUI
import FirebaseCore

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        FirebaseApp.configure()
        return true
    }
}

@main
struct PollsPlusApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate
    @StateObject private var network = NetworkManager.shared

    var body: some Scene {
        WindowGroup {
            MainTabView()
                .environmentObject(network)
                .animation(.easeInOut, value: network.isLoggedIn)
        }
    }
}
