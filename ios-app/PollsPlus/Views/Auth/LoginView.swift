import SwiftUI

struct LoginView: View {
    @EnvironmentObject var network: NetworkManager
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var isLoading = false
    @State private var showRegister = false

    var body: some View {
        NavigationStack {
            ZStack {
                // Background gradient
                LinearGradient(
                    colors: [Color(red: 0.08, green: 0.08, blue: 0.15), Color(red: 0.12, green: 0.1, blue: 0.25)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                VStack(spacing: 28) {
                    Spacer()

                    logoSection

                    Spacer()

                    formSection

                    Button("Don't have an account? Sign Up") {
                        showRegister = true
                    }
                    .font(.subheadline.bold())
                    .foregroundStyle(.white.opacity(0.7))

                    Spacer()
                }
                .padding(.horizontal, 24)
            }
            .navigationDestination(isPresented: $showRegister) {
                RegisterView()
            }
        }
    }

    private var logoSection: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(colors: [.blue, .purple], startPoint: .topLeading, endPoint: .bottomTrailing)
                    )
                    .frame(width: 80, height: 80)
                    .shadow(color: .blue.opacity(0.5), radius: 20)

                Image(systemName: "chart.bar.fill")
                    .font(.system(size: 36, weight: .bold))
                    .foregroundColor(.white)
            }

            Text("PollsPlus")
                .font(.system(size: 34, weight: .heavy, design: .rounded))
                .foregroundColor(.white)

            Text("Vote on debates. Share your opinion.")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.6))
        }
    }

    private var formSection: some View {
        VStack(spacing: 14) {
            styledField(icon: "envelope.fill", placeholder: "Email", text: $email, isSecure: false)
            styledField(icon: "lock.fill", placeholder: "Password", text: $password, isSecure: true)

            if let error = error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            Button {
                doLogin()
            } label: {
                HStack {
                    if isLoading {
                        ProgressView().tint(.white)
                    }
                    Text("Log In")
                        .font(.headline)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(
                    LinearGradient(colors: [.blue, .purple], startPoint: .leading, endPoint: .trailing)
                )
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .shadow(color: .blue.opacity(0.4), radius: 10, y: 4)
            }
            .disabled(isLoading || email.isEmpty || password.isEmpty)
        }
    }

    private func styledField(icon: String, placeholder: String, text: Binding<String>, isSecure: Bool) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(.white.opacity(0.5))
                .frame(width: 20)
            if isSecure {
                SecureField(placeholder, text: text)
                    .foregroundColor(.white)
            } else {
                TextField(placeholder, text: text)
                    .foregroundColor(.white)
                    .autocapitalization(.none)
                    .keyboardType(.emailAddress)
            }
        }
        .padding(14)
        .background(Color.white.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.1), lineWidth: 1)
        )
    }

    private func doLogin() {
        isLoading = true
        error = nil
        Task {
            do {
                _ = try await network.login(email: email, password: password)
            } catch {
                self.error = error.localizedDescription
            }
            isLoading = false
        }
    }
}
