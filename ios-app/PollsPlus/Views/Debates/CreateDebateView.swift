import SwiftUI

struct CreateDebateView: View {
    @EnvironmentObject var network: NetworkManager
    @Environment(\.dismiss) var dismiss

    // If passed in, we skip the "Post to" picker and post directly to this community
    var preselectedCommunityId: Int? = nil
    var preselectedCommunityName: String? = nil

    @State private var title = ""
    @State private var options = ["", ""]
    @State private var isLoading = false
    @State private var error: String?
    @State private var showPostTo = false

    var canSubmit: Bool {
        let validOptions = options.filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        return validOptions.count >= 2 && !isLoading
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    titleSection
                    optionsSection
                    errorSection
                    postToButton
                }
                .padding()
            }
            .navigationTitle("New Debate")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .sheet(isPresented: $showPostTo) {
                PostToPickerView(
                    canSubmit: canSubmit,
                    onSelectCategory: { category in
                        submitToCategory(category)
                    },
                    onSelectCommunity: { communityId, category in
                        submitToCommunity(communityId: communityId, category: category)
                    }
                )
            }
        }
    }

    // MARK: - Subviews

    private var titleSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Title")
                .font(.subheadline.bold())
                .foregroundStyle(.secondary)
            TextField("What's the debate?", text: $title)
                .font(.body)
                .padding(12)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    private var optionsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Options")
                .font(.subheadline.bold())
                .foregroundStyle(.secondary)

            ForEach(options.indices, id: \.self) { i in
                optionRow(index: i)
            }

            if options.count < 6 {
                Button {
                    options.append("")
                } label: {
                    Label("Add Option", systemImage: "plus.circle.fill")
                        .font(.subheadline.bold())
                        .foregroundStyle(.blue)
                }
                .padding(.top, 4)
            }
        }
    }

    private func optionRow(index i: Int) -> some View {
        HStack(spacing: 8) {
            Text("\(Character(UnicodeScalar(65 + i)!))")
                .font(.subheadline.bold())
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(.blue)
                .clipShape(Circle())

            TextField("Option \(Character(UnicodeScalar(65 + i)!))", text: $options[i])
                .font(.body)
                .padding(10)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 10))

            if options.count > 2 {
                Button {
                    options.remove(at: i)
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    @ViewBuilder
    private var errorSection: some View {
        if let error = error {
            Text(error)
                .font(.caption)
                .foregroundStyle(.red)
        }
    }

    private var postToButton: some View {
        Button {
            if let communityId = preselectedCommunityId {
                // Already know the community, just post
                submitToCommunity(communityId: communityId, category: "General")
            } else {
                showPostTo = true
            }
        } label: {
            HStack {
                if isLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Image(systemName: "paperplane.fill")
                    if let name = preselectedCommunityName {
                        Text("Post to \(name)")
                    } else {
                        Text("Post to...")
                    }
                }
            }
            .font(.headline)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(canSubmit ? .blue : Color(.systemGray4))
            .foregroundColor(.white)
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .disabled(!canSubmit || isLoading)
        .padding(.top, 8)
    }

    // MARK: - Submit Actions

    private func submitToCategory(_ category: String) {
        showPostTo = false
        isLoading = true
        error = nil
        let validOptions = options.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        Task {
            do {
                _ = try await network.createDebate(
                    title: title.isEmpty ? nil : title,
                    category: category,
                    options: validOptions,
                    communityId: nil
                )
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
            isLoading = false
        }
    }

    private func submitToCommunity(communityId: Int, category: String) {
        showPostTo = false
        isLoading = true
        error = nil
        let validOptions = options.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        Task {
            do {
                _ = try await network.createDebate(
                    title: title.isEmpty ? nil : title,
                    category: category,
                    options: validOptions,
                    communityId: communityId
                )
                dismiss()
            } catch {
                self.error = error.localizedDescription
            }
            isLoading = false
        }
    }
}

// MARK: - Post To Picker

struct PostToPickerView: View {
    @EnvironmentObject var network: NetworkManager
    @Environment(\.dismiss) var dismiss

    let canSubmit: Bool
    let onSelectCategory: (String) -> Void
    let onSelectCommunity: (Int, String) -> Void

    @State private var showCommunities = false
    @State private var myCommunities: [Community] = []
    @State private var isLoadingCommunities = false

    var body: some View {
        NavigationStack {
            List {
                categoriesSection
                communitiesSection
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Post to")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private var categoriesSection: some View {
        Section("Categories") {
            ForEach(CategoryHelper.all, id: \.self) { cat in
                Button {
                    onSelectCategory(cat)
                } label: {
                    categoryRow(cat)
                }
            }
        }
    }

    private func categoryRow(_ cat: String) -> some View {
        HStack(spacing: 12) {
            CategoryIcon(category: cat, size: 36)
            Text(cat)
                .font(.body.weight(.medium))
                .foregroundStyle(.primary)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var communitiesSection: some View {
        Section("My Communities") {
            if !showCommunities {
                Button {
                    showCommunities = true
                    loadMyCommunities()
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "person.3.fill")
                            .font(.body)
                            .foregroundStyle(.blue)
                            .frame(width: 36, height: 36)
                            .background(Color(.systemGray5))
                            .clipShape(Circle())
                        Text("Show My Communities")
                            .font(.body.weight(.medium))
                            .foregroundStyle(.primary)
                        Spacer()
                        Image(systemName: "chevron.down")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            } else if isLoadingCommunities {
                ProgressView()
                    .frame(maxWidth: .infinity)
            } else if myCommunities.isEmpty {
                Text("You haven't joined any communities yet")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(myCommunities) { community in
                    Button {
                        onSelectCommunity(community.id, community.category)
                    } label: {
                        communityRow(community)
                    }
                }
            }
        }
    }

    private func communityRow(_ community: Community) -> some View {
        HStack(spacing: 12) {
            CategoryIcon(category: community.category, size: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(community.name)
                    .font(.body.weight(.medium))
                    .foregroundStyle(.primary)
                Text("\(community.memberCount ?? 0) members")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private func loadMyCommunities() {
        isLoadingCommunities = true
        Task {
            do {
                let resp = try await network.feedCommunities(page: 1)
                // Get unique community IDs from the debates
                var seen = Set<Int>()
                var communities: [Community] = []
                for category in CategoryHelper.all {
                    let browse = try await network.browseCommunities(category: category)
                    for c in browse.communities where c.isMember == true && !seen.contains(c.id) {
                        seen.insert(c.id)
                        communities.append(c)
                    }
                }
                myCommunities = communities
            } catch {}
            isLoadingCommunities = false
        }
    }
}

// MARK: - Reusable Category Picker Grid
struct CategoryPickerGrid: View {
    @Binding var selectedCategory: String

    private let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        LazyVGrid(columns: columns, spacing: 8) {
            ForEach(CategoryHelper.all, id: \.self) { cat in
                CategoryPickerButton(category: cat, isSelected: selectedCategory == cat) {
                    selectedCategory = cat
                }
            }
        }
    }
}

struct CategoryPickerButton: View {
    let category: String
    let isSelected: Bool
    let action: () -> Void

    private var catColor: Color { CategoryHelper.color(for: category) }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: CategoryHelper.icon(for: category))
                    .font(.system(size: 11, weight: .bold))
                Text(category)
                    .font(.system(size: 12, weight: .semibold))
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 11)
            .background(isSelected ? catColor : catColor.opacity(0.1))
            .foregroundColor(isSelected ? .white : catColor)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(color: isSelected ? catColor.opacity(0.3) : .clear, radius: 4, y: 2)
        }
    }
}
