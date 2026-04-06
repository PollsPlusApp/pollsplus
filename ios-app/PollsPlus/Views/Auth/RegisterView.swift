import SwiftUI

struct RegisterView: View {
    @EnvironmentObject var network: NetworkManager
    @Environment(\.dismiss) var dismiss
    @State private var username = ""
    @State private var email = ""
    @State private var password = ""
    @State private var selectedCategory = "General"
    @State private var error: String?
    @State private var isLoading = false

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                Text("Create Account")
                    .font(.system(size: 28, weight: .heavy, design: .rounded))
                    .padding(.top)

                VStack(spacing: 16) {
                    formFields
                    categoryPicker
                    errorMessage
                    registerButton
                }
                .padding(.horizontal)
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationBarTitleDisplayMode(.inline)
    }

    private var formFields: some View {
        VStack(spacing: 12) {
            StyledInput(icon: "person.fill", placeholder: "Username", text: $username)
                .autocapitalization(.none)
            StyledInput(icon: "envelope.fill", placeholder: "Email", text: $email)
                .autocapitalization(.none)
                .keyboardType(.emailAddress)
            StyledSecureInput(icon: "lock.fill", placeholder: "Password (6+ characters)", text: $password)
        }
    }

    private var categoryPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Choose your vibe")
                .font(.subheadline.bold())
                .foregroundStyle(.secondary)
            CategoryPickerGrid(selectedCategory: $selectedCategory)
        }
    }

    @ViewBuilder
    private var errorMessage: some View {
        if let error = error {
            Text(error)
                .font(.caption)
                .foregroundStyle(.red)
        }
    }

    private var registerButton: some View {
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
            .shadow(color: CategoryHelper.color(for: selectedCategory).opacity(0.4), radius: 10, y: 4)
        }
        .disabled(isLoading || username.isEmpty || email.isEmpty || password.count < 6)
    }

    private func doRegister() {
        isLoading = true
        error = nil
        Task {
            do {
                _ = try await network.register(username: username, email: email, password: password, category: selectedCategory)
            } catch {
                self.error = error.localizedDescription
            }
            isLoading = false
        }
    }
}

// MARK: - Styled Input Fields

struct StyledInput: View {
    let icon: String
    let placeholder: String
    @Binding var text: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(.secondary)
                .frame(width: 20)
            TextField(placeholder, text: $text)
        }
        .padding(14)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.04), radius: 4, y: 2)
    }
}

struct StyledSecureInput: View {
    let icon: String
    let placeholder: String
    @Binding var text: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(.secondary)
                .frame(width: 20)
            SecureField(placeholder, text: $text)
        }
        .padding(14)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.04), radius: 4, y: 2)
    }
}
