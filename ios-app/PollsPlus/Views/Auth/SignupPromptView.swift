import SwiftUI

/// Sheet that encourages signup during demo mode.
/// Gives users a quick register flow, or switch to login if they have an account.
struct SignupPromptView: View {
    @EnvironmentObject var network: NetworkManager
    @Environment(\.dismiss) var dismiss

    /// Optional context-specific message ("Sign up to save your vote on ...")
    var contextMessage: String? = nil

    @State private var showLogin = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if showLogin {
                    LoginView()
                } else {
                    registerPrompt
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button(showLogin ? "Sign Up" : "Log In") {
                        showLogin.toggle()
                    }
                    .font(.subheadline.bold())
                }
            }
        }
    }

    private var registerPrompt: some View {
        ScrollView {
            VStack(spacing: 18) {
                heroSection
                RegisterForm()
            }
            .padding()
        }
        .background(Color(.systemGroupedBackground))
    }

    private var heroSection: some View {
        VStack(spacing: 8) {
            ZStack {
                Circle()
                    .fill(LinearGradient(colors: [.blue, .purple], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 64, height: 64)
                    .shadow(color: .blue.opacity(0.4), radius: 12)
                Image(systemName: "chart.bar.fill")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(.white)
            }

            if let msg = contextMessage {
                Text(msg)
                    .font(.headline)
                    .multilineTextAlignment(.center)
                    .padding(.top, 6)
            } else {
                Text("Create a free account")
                    .font(.title2.bold())
            }

            // Free badge
            HStack(spacing: 5) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.caption.bold())
                Text("100% free — no payment required")
                    .font(.caption.bold())
            }
            .foregroundColor(.green)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color.green.opacity(0.12))
            .clipShape(Capsule())

            Text("Save your votes, follow people, start debates, and join communities.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .padding(.top, 8)
    }
}

/// Minimal register form extracted so SignupPromptView can embed it.
/// Same logic as RegisterView but laid out for the sheet context.
struct RegisterForm: View {
    @EnvironmentObject var network: NetworkManager
    @Environment(\.dismiss) var dismiss

    @State private var username = ""
    @State private var email = ""
    @State private var password = ""
    @State private var selectedCategory = "General"
    @State private var error: String?
    @State private var isLoading = false

    var body: some View {
        VStack(spacing: 14) {
            StyledInput(icon: "person.fill", placeholder: "Username", text: $username)
                .autocapitalization(.none)
            StyledInput(icon: "envelope.fill", placeholder: "Email", text: $email)
                .autocapitalization(.none)
                .keyboardType(.emailAddress)
            StyledSecureInput(icon: "lock.fill", placeholder: "Password (6+ characters)", text: $password)

            VStack(alignment: .leading, spacing: 8) {
                Text("Choose your vibe")
                    .font(.subheadline.bold())
                    .foregroundStyle(.secondary)
                CategoryPickerGrid(selectedCategory: $selectedCategory)
            }
            .padding(.top, 6)

            if let error = error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            Button {
                doRegister()
            } label: {
                HStack {
                    if isLoading { ProgressView().tint(.white) }
                    Text("Create Account")
                        .font(.headline)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(CategoryHelper.gradient(for: selectedCategory))
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .shadow(color: CategoryHelper.color(for: selectedCategory).opacity(0.35), radius: 10, y: 4)
            }
            .disabled(isLoading || username.isEmpty || email.isEmpty || password.count < 6)
        }
    }

    private func doRegister() {
        isLoading = true
        error = nil
        Task {
            do {
                _ = try await network.register(username: username, email: email, password: password, category: selectedCategory)
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
            isLoading = false
        }
    }
}
