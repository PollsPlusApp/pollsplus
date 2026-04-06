import SwiftUI

struct CreateCommunityView: View {
    @EnvironmentObject var network: NetworkManager
    @Environment(\.dismiss) var dismiss

    @State private var name = ""
    @State private var selectedCategory = "General"
    @State private var isPrivate = false
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    nameSection
                    categorySection
                    privacyToggle
                    errorMessage
                }
                .padding()
            }
            .navigationTitle("New Community")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    createButton
                }
            }
        }
    }

    // MARK: - Extracted Subviews

    private var nameSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Community Name")
                .font(.subheadline.bold())
            TextField("Name your community", text: $name)
                .textFieldStyle(.roundedBorder)
        }
    }

    private var categorySection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Category")
                .font(.subheadline.bold())
            CategoryPickerGrid(selectedCategory: $selectedCategory)
        }
    }

    private var privacyToggle: some View {
        Toggle(isOn: $isPrivate) {
            VStack(alignment: .leading) {
                Text("Private Community")
                    .font(.subheadline.bold())
                Text("Members must request to join and be approved")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
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

    @ViewBuilder
    private var createButton: some View {
        Button {
            submit()
        } label: {
            if isLoading { ProgressView() }
            else { Text("Create").fontWeight(.bold) }
        }
        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || isLoading)
    }

    // MARK: - Actions

    private func submit() {
        isLoading = true
        error = nil
        Task {
            do {
                _ = try await network.createCommunity(name: name.trimmingCharacters(in: .whitespaces), category: selectedCategory, isPrivate: isPrivate)
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
            isLoading = false
        }
    }
}
