import SwiftUI

struct CommentSection: View {
    @EnvironmentObject var network: NetworkManager
    let debateId: Int

    @State private var comments: [Comment] = []
    @State private var totalCount = 0
    @State private var isLoading = true
    @State private var newComment = ""
    @State private var replyingTo: Comment? = nil
    @State private var isPosting = false
    @State private var expandedReplies: [Int: [Comment]] = [:]
    @State private var loadingReplies: Set<Int> = []

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            headerRow
            commentInput
            commentsList
        }
        .task { await loadComments() }
    }

    // MARK: - Header

    private var headerRow: some View {
        HStack {
            Text("\(totalCount) Comment\(totalCount == 1 ? "" : "s")")
                .font(.subheadline.bold())
            Spacer()
        }
    }

    // MARK: - Input

    private var commentInput: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let reply = replyingTo {
                HStack(spacing: 6) {
                    Text("Replying to \(reply.username)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Button {
                        replyingTo = nil
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            HStack(spacing: 8) {
                TextField(replyingTo != nil ? "Write a reply..." : "Add a comment...", text: $newComment)
                    .font(.subheadline)
                    .padding(10)
                    .background(Color(.systemGray6))
                    .clipShape(RoundedRectangle(cornerRadius: 10))

                Button {
                    Task { await postComment() }
                } label: {
                    if isPosting {
                        ProgressView()
                            .frame(width: 32, height: 32)
                    } else {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                            .foregroundStyle(newComment.trimmingCharacters(in: .whitespaces).isEmpty ? .gray : .blue)
                    }
                }
                .disabled(newComment.trimmingCharacters(in: .whitespaces).isEmpty || isPosting)
            }
        }
    }

    // MARK: - List

    @ViewBuilder
    private var commentsList: some View {
        if isLoading {
            ProgressView()
                .frame(maxWidth: .infinity)
                .padding()
        } else if comments.isEmpty {
            Text("No comments yet — be the first!")
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
                .padding()
        } else {
            VStack(spacing: 0) {
                ForEach(comments) { comment in
                    commentRow(comment)
                    repliesSection(for: comment)
                    Divider().padding(.leading, 52)
                }
            }
        }
    }

    private func commentRow(_ comment: Comment) -> some View {
        HStack(alignment: .top, spacing: 10) {
            CategoryIcon(category: comment.userCategory, size: 32)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(comment.username)
                        .font(.caption.bold())
                    Text(comment.timeAgo)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }

                Text(comment.content)
                    .font(.subheadline)

                HStack(spacing: 16) {
                    Button {
                        replyingTo = comment
                    } label: {
                        HStack(spacing: 3) {
                            Image(systemName: "arrowshape.turn.up.left.fill")
                                .font(.caption2)
                            Text("Reply")
                                .font(.caption)
                        }
                        .foregroundStyle(.secondary)
                    }

                    if comment.replyCount > 0 && expandedReplies[comment.id] == nil {
                        Button {
                            Task { await loadReplies(for: comment) }
                        } label: {
                            HStack(spacing: 3) {
                                if loadingReplies.contains(comment.id) {
                                    ProgressView().scaleEffect(0.6)
                                }
                                Text("\(comment.replyCount) repl\(comment.replyCount == 1 ? "y" : "ies")")
                                    .font(.caption.bold())
                            }
                            .foregroundStyle(.blue)
                        }
                    }

                    if comment.userId == network.currentUserId {
                        Button {
                            Task { await deleteComment(comment) }
                        } label: {
                            Image(systemName: "trash")
                                .font(.caption2)
                                .foregroundStyle(.red.opacity(0.6))
                        }
                    }
                }
            }

            Spacer()
        }
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private func repliesSection(for comment: Comment) -> some View {
        if let replies = expandedReplies[comment.id] {
            VStack(spacing: 0) {
                ForEach(replies) { reply in
                    HStack(spacing: 0) {
                        Rectangle()
                            .fill(Color(.systemGray4))
                            .frame(width: 2)
                            .padding(.leading, 16)
                        commentRow(reply)
                            .padding(.leading, 8)
                    }
                }
            }
        }
    }

    // MARK: - Actions

    private func loadComments() async {
        do {
            let resp = try await network.getComments(debateId: debateId)
            comments = resp.comments
            totalCount = resp.totalCount
        } catch {}
        isLoading = false
    }

    private func postComment() async {
        let text = newComment.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        isPosting = true
        do {
            let comment = try await network.postComment(
                debateId: debateId,
                content: text,
                parentId: replyingTo?.id
            )
            if replyingTo != nil {
                // Add reply to expanded replies
                let parentId = replyingTo!.id
                if expandedReplies[parentId] != nil {
                    expandedReplies[parentId]?.append(comment)
                } else {
                    expandedReplies[parentId] = [comment]
                }
                replyingTo = nil
            } else {
                comments.append(comment)
            }
            totalCount += 1
            newComment = ""
        } catch {}
        isPosting = false
    }

    private func loadReplies(for comment: Comment) async {
        loadingReplies.insert(comment.id)
        do {
            let resp = try await network.getReplies(debateId: debateId, commentId: comment.id)
            expandedReplies[comment.id] = resp.replies
        } catch {}
        loadingReplies.remove(comment.id)
    }

    private func deleteComment(_ comment: Comment) async {
        do {
            try await network.deleteComment(debateId: debateId, commentId: comment.id)
            comments.removeAll { $0.id == comment.id }
            expandedReplies.removeValue(forKey: comment.id)
            totalCount -= 1
        } catch {}
    }
}
